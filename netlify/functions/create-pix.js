/**
 * Netlify Function: create-pix
 * Integração com Gateway XPay Brasil (https://docs.xpaybrasil.com/docs)
 */

const XPAY_API_URL = "https://api.xpaybrasil.com/v1/charge/pix";
const XPAY_KEY = process.env.XPAY_KEY || "cpk_live_ex84lopcp2xexagmazz6za11";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json"
};

function formatCpf(val) {
  const digits = String(val || "").replace(/\D/g, "");
  return digits.length === 11 ? digits : "07580365316";
}

function formatPhone(val) {
  const digits = String(val || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits : "11987654321";
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Método não permitido. Use POST." })
    };
  }

  try {
    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch (e) {
      body = {};
    }

    // Amount em centavos
    let rawAmount = body.amount;
    let amountInCents = 3684; // Fallback padrão (R$ 36,84)

    if (typeof rawAmount === "number") {
      if (rawAmount > 0 && rawAmount < 500) {
        amountInCents = Math.round(rawAmount * 100);
      } else if (rawAmount >= 500) {
        amountInCents = Math.round(rawAmount);
      }
    } else if (typeof rawAmount === "string") {
      let parsed = parseFloat(rawAmount.replace(",", "."));
      if (!isNaN(parsed) && parsed > 0) {
        if (parsed < 500) {
          amountInCents = Math.round(parsed * 100);
        } else {
          amountInCents = Math.round(parsed);
        }
      }
    }

    // Garante mínimo exigido pela XPay (500 centavos = R$ 5,00)
    if (amountInCents < 500) amountInCents = 500;

    const customerData = body.customer || {};
    const cpfClean = formatCpf(customerData.cpf || customerData.document || customerData.taxId || body.cpf || body.document || body.taxId);
    const nameClean = customerData.name || body.name || "Cliente";
    const emailClean = customerData.email || body.email || `cliente${cpfClean.slice(0, 6)}@email.com`;
    const phoneClean = formatPhone(customerData.phone || body.phone);
    const externalId = body.externalId || `charge_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const payload = {
      amount: amountInCents,
      expiresIn: 1800,
      externalId: externalId,
      customer: {
        taxId: cpfClean,
        name: nameClean,
        email: emailClean,
        phone: phoneClean
      }
    };

    const response = await fetch(XPAY_API_URL, {
      method: "POST",
      headers: {
        "X-API-KEY": XPAY_KEY,
        "Authorization": `Bearer ${XPAY_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const resData = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status || 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          error: resData.message || "Erro ao gerar cobrança no gateway XPay Brasil",
          details: resData
        })
      };
    }

    const txId = resData.id || "";
    const brCode = resData.brCode || "";
    const brCodeBase64 = resData.brCodeBase64 || "";

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        transactionId: txId,
        id: txId,
        qrCode: brCode,
        pixCopiaECola: brCode,
        qrCodeBase64: brCodeBase64,
        status: resData.status || "PROCESSING",
        data: resData
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: "Erro interno no servidor ao processar requisição PIX",
        message: err.message
      })
    };
  }
};
