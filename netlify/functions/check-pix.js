/**
 * Netlify Function: check-pix
 * Consulta de status de transação no Gateway XPay Brasil (https://docs.xpaybrasil.com/docs)
 */

const XPAY_API_BASE = "https://api.xpaybrasil.com/v1/charge";
const XPAY_KEY = process.env.XPAY_KEY || "cpk_live_ex84lopcp2xexagmazz6za11";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ""
    };
  }

  try {
    const q = event.queryStringParameters || {};
    let id = q.id || q.transactionId;

    if (!id && event.body) {
      try {
        const body = JSON.parse(event.body);
        id = body.id || body.transactionId;
      } catch (e) {}
    }

    if (!id) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Parâmetro 'id' ou 'transactionId' é obrigatório." })
      };
    }

    const response = await fetch(`${XPAY_API_BASE}/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: {
        "X-API-KEY": XPAY_KEY,
        "Authorization": `Bearer ${XPAY_KEY}`,
        "Accept": "application/json"
      }
    });

    const resData = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status || 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: resData.message || "Erro ao consultar status no gateway XPay Brasil",
          details: resData
        })
      };
    }

    const tx = resData.data || {};
    const rawStatus = (tx.status || "").toUpperCase();
    const paymentStatus = (tx.paymentStatus || "").toUpperCase();
    const isPaid = (rawStatus === "COMPLETED" || paymentStatus === "PAID" || paymentStatus === "RECIEVED");

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        id: tx.id || id,
        status: isPaid ? "PAID" : rawStatus,
        paymentStatus: paymentStatus,
        paid: isPaid,
        data: tx
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Erro interno no servidor ao consultar PIX",
        message: err.message
      })
    };
  }
};
