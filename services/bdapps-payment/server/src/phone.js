export function toSubscriberId(input) {
  if (typeof input !== "string" || !input.trim()) {
    throw Object.assign(new Error("A Bangladesh mobile number is required"), { status: 400 });
  }

  const value = input.trim();
  if (/^tel:[a-z]/i.test(value)) return value;

  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length === 13) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith("88") && digits.length === 12) digits = `0${digits.slice(2)}`;
  else if (digits.length === 10 && digits.startsWith("1")) digits = `0${digits}`;

  if (!/^01[3-9]\d{8}$/.test(digits)) {
    throw Object.assign(new Error("Use a valid Bangladesh mobile number, for example 01812345678"), { status: 400 });
  }
  return `tel:88${digits}`;
}
