import pg from "pg";
import { createPoolConfig } from "./database.js";

const { Pool } = pg;

export class PostgresRepository {
  constructor(connectionString) {
    this.pool = new Pool({ ...createPoolConfig(connectionString), max: 10 });
  }

  async health() {
    await this.pool.query("select 1");
  }

  async recordEvent(eventType, payload) {
    const requestId = payload.requestId ?? payload.referenceNo ?? payload.externalTrxId ?? null;
    const subscriberId = payload.subscriberId ?? payload.sourceAddress ?? payload.destinationAddress ?? null;
    await this.pool.query(
      `insert into bdapps_events (event_type, request_id, subscriber_id, payload)
       values ($1, $2, $3, $4)`,
      [eventType, requestId, subscriberId, payload]
    );
  }

  async saveOtpRequest({ referenceNo, subscriberId, statusCode }) {
    if (!referenceNo) return;
    await this.pool.query(
      `insert into bdapps_otp_requests (reference_no, subscriber_id, status_code)
       values ($1, $2, $3)
       on conflict (reference_no) do update set status_code = excluded.status_code`,
      [referenceNo, subscriberId, statusCode ?? null]
    );
  }

  async markOtpVerified(referenceNo, response) {
    await this.pool.query(
      `update bdapps_otp_requests
       set status_code = $2, verified_at = case when $2 = 'S1000' then now() else verified_at end
       where reference_no = $1`,
      [referenceNo, response.statusCode ?? null]
    );
    if (response.subscriberId) {
      await this.pool.query(
        `insert into bdapps_subscribers (subscriber_id, subscription_status)
         values ($1, $2)
         on conflict (subscriber_id) do update
         set subscription_status = excluded.subscription_status, updated_at = now()`,
        [response.subscriberId, response.subscriptionStatus ?? "UNKNOWN"]
      );
    }
  }

  async createPendingTransaction(payload) {
    const result = await this.pool.query(
      `insert into bdapps_transactions
         (external_trx_id, subscriber_id, amount, currency, state, request_payload, payload, attempt_count)
       values ($1, $2, $3, $4, 'PENDING', $5, $5, 1)
       on conflict (external_trx_id) do nothing
       returning external_trx_id`,
      [
        payload.externalTrxId,
        payload.subscriberId ?? null,
        payload.amount ?? null,
        payload.currency ?? "BDT",
        payload
      ]
    );
    return result.rowCount === 1;
  }

  async completeTransaction(requestPayload, responsePayload, state) {
    await this.pool.query(
      `update bdapps_transactions
       set internal_trx_id = $2,
           status_code = $3,
           status_detail = $4,
           state = $5,
           response_payload = $6,
           payload = $7,
           last_error = null,
           updated_at = now()
       where external_trx_id = $1`,
      [
        requestPayload.externalTrxId,
        responsePayload.internalTrxId ?? null,
        responsePayload.statusCode ?? null,
        responsePayload.statusDetail ?? null,
        state,
        responsePayload,
        { ...requestPayload, ...responsePayload }
      ]
    );
  }

  async markTransactionUnknown(externalTrxId, error) {
    await this.pool.query(
      `update bdapps_transactions
       set state = 'UNKNOWN', last_error = $2, updated_at = now()
       where external_trx_id = $1`,
      [externalTrxId, String(error?.message || "Unknown provider result").slice(0, 500)]
    );
  }

  async getTransaction(externalTrxId) {
    const result = await this.pool.query(
      `select external_trx_id as "externalTrxId", internal_trx_id as "internalTrxId",
              subscriber_id as "subscriberId", amount, currency, state,
              status_code as "statusCode", status_detail as "statusDetail",
              request_payload as "requestPayload", response_payload as "responsePayload",
              last_error as "lastError", attempt_count as "attemptCount",
              created_at as "createdAt", updated_at as "updatedAt"
       from bdapps_transactions where external_trx_id = $1`,
      [externalTrxId]
    );
    return result.rows[0] ?? null;
  }

  async getDashboardSummary() {
    const result = await this.pool.query(
      `select
         (select count(*)::int from bdapps_transactions) as "totalTransactions",
         (select count(*)::int from bdapps_transactions where state = 'SUCCEEDED') as "succeededTransactions",
         (select count(*)::int from bdapps_transactions where state = 'FAILED') as "failedTransactions",
         (select count(*)::int from bdapps_transactions where state = 'UNKNOWN') as "unknownTransactions",
         (select count(*)::int from bdapps_transactions where state = 'PENDING') as "pendingTransactions",
         (select coalesce(sum(amount), 0)::text from bdapps_transactions where state = 'SUCCEEDED') as "succeededAmount",
         (select max(updated_at) from bdapps_transactions) as "lastTransactionAt",
         (select count(*)::int from bdapps_events) as "totalEvents",
         (select max(received_at) from bdapps_events) as "lastEventAt"`
    );
    return result.rows[0];
  }

  async listTransactions({ limit = 25, offset = 0, state, query } = {}) {
    const conditions = [];
    const values = [];
    if (state) {
      values.push(state);
      conditions.push(`state = $${values.length}`);
    }
    if (query) {
      values.push(`%${query}%`);
      const position = values.length;
      conditions.push(`(
        external_trx_id ilike $${position}
        or coalesce(internal_trx_id, '') ilike $${position}
        or coalesce(subscriber_id, '') ilike $${position}
        or coalesce(status_code, '') ilike $${position}
        or coalesce(status_detail, '') ilike $${position}
      )`);
    }
    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
    const countValues = [...values];
    values.push(limit, offset);
    const limitPosition = values.length - 1;
    const offsetPosition = values.length;
    const [rows, count] = await Promise.all([
      this.pool.query(
        `select external_trx_id as "externalTrxId", internal_trx_id as "internalTrxId",
                subscriber_id as "subscriberId", amount, currency, state,
                status_code as "statusCode", status_detail as "statusDetail",
                request_payload as "requestPayload", response_payload as "responsePayload",
                last_error as "lastError", attempt_count as "attemptCount",
                created_at as "createdAt", updated_at as "updatedAt"
         from bdapps_transactions
         ${where}
         order by updated_at desc, external_trx_id desc
         limit $${limitPosition} offset $${offsetPosition}`,
        values
      ),
      this.pool.query(`select count(*)::int as total from bdapps_transactions ${where}`, countValues)
    ]);
    return { rows: rows.rows, total: count.rows[0].total };
  }

  async listEvents(options = {}) {
    const normalized = typeof options === "number" ? { limit: options } : options;
    const { limit = 25, offset = 0, eventType, query } = normalized;
    const conditions = [];
    const values = [];
    if (eventType) {
      values.push(eventType);
      conditions.push(`event_type = $${values.length}`);
    }
    if (query) {
      values.push(`%${query}%`);
      const position = values.length;
      conditions.push(`(
        event_type ilike $${position}
        or coalesce(request_id, '') ilike $${position}
        or coalesce(subscriber_id, '') ilike $${position}
        or payload::text ilike $${position}
      )`);
    }
    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
    const countValues = [...values];
    values.push(limit, offset);
    const limitPosition = values.length - 1;
    const offsetPosition = values.length;
    const [rows, count] = await Promise.all([
      this.pool.query(
        `select id, event_type as "eventType", request_id as "requestId",
                subscriber_id as "subscriberId", payload, received_at as "receivedAt"
         from bdapps_events
         ${where}
         order by received_at desc, id desc
         limit $${limitPosition} offset $${offsetPosition}`,
        values
      ),
      this.pool.query(`select count(*)::int as total from bdapps_events ${where}`, countValues)
    ]);
    return { rows: rows.rows, total: count.rows[0].total };
  }

  close() {
    return this.pool.end();
  }
}
