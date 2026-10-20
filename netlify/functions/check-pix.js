/**
 * Netlify Function: check-pix
 * Consulta de status de transação no Gateway Bynet (https://docs.techbynet.com/)
 */

const TECHBYNET_API_BASE = "https://api-gateway.techbynet.com/api/user/transactions";
const TECHBYNET_KEY = process.env.TECHBYNET_KEY || "f3496353-b145-431a-91ac-1e47968b5b6f";
const USER_AGENT = "AtivoB2B/1.0";

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

    const response = await fetch(`${TECHBYNET_API_BASE}/${encodeURIComponent(id)}/summary`, {
      method: "GET",
      headers: {
        "x-api-key": TECHBYNET_KEY,
        "User-Agent": USER_AGENT,
        "Accept": "application/json"
      }
    });

    const resData = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status || 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: resData.message || "Erro ao consultar status no gateway Bynet",
          details: resData
        })
      };
    }

    const tx = resData.data || {};
    const rawStatus = (tx.status || "").toUpperCase();
    const isPaid = (rawStatus === "PAID" || rawStatus === "APPROVED" || rawStatus === "COMPLETED");

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        id: tx.id || id,
        status: rawStatus,
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
