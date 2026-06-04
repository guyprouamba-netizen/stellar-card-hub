const BASE = "https://api.yengapay.com/api/v1";

function cfg() {
  const apiKey = process.env.YENGAPAY_API_KEY;
  const groupId = process.env.YENGAPAY_GROUP_ID;
  const projectId = process.env.YENGAPAY_PROJECT_ID;
  if (!apiKey || !groupId || !projectId) throw new Error("YengaPay env missing");
  return { apiKey, groupId, projectId };
}

export async function createYengaPayment(amount: number, reference: string, callbackUrl: string): Promise<any> {
  const { apiKey, groupId, projectId } = cfg();
  const url = `${BASE}/groups/${groupId}/payment-intent/${projectId}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      paymentAmount: amount,
      reference,
      articles: [{ title: "Recharge FASO-INVEST PAY", description: "Recharge portefeuille", pictures: [], price: amount }],
      callbackUrl,
    }),
  });
  const text = await res.text();
  let body: any = text;
  try { body = JSON.parse(text); } catch { /* keep */ }
  if (!res.ok) throw new Error(`YengaPay ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  return body;
}