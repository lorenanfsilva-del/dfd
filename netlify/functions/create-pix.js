/**
 * Netlify Function: create-pix
 * Integração com Gateway Bynet (https://docs.techbynet.com/)
 */

const TECHBYNET_API_URL = "https://api-gateway.techbynet.com/api/user/transactions";
const TECHBYNET_KEY = process.env.TECHBYNET_KEY || "f3496353-b145-431a-91ac-1e47968b5b6f";
const USER_AGENT = "AtivoB2B/1.0";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-api-key, Authorization",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Content-Type": "application/json"
};

function formatCpf(val) {
  const digits = String(val || "").replace(/\D/g, "");
  return digits || "07580365316";
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
      // Se vier float como 36.84 ou centavos como 3684
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

    const customerData = body.customer || {};
    const cpfClean = formatCpf(customerData.cpf || customerData.document || body.cpf || body.document);
    const nameClean = customerData.name || body.name || "Cliente";
    const emailClean = customerData.email || body.email || `cliente${cpfClean.slice(0, 6)}@email.com`;
    const phoneClean = formatPhone(customerData.phone || body.phone);
    const title = body.title || body.description || "Liberacao de Credito";

    const payload = {
      amount: amountInCents,
      paymentMethod: "PIX",
      customer: {
        name: nameClean,
        email: emailClean,
        document: {
          number: cpfClean,
          type: "CPF"
        },
        phone: phoneClean,
        externalRef: body.externalRef || `cli-${Date.now()}`,
        address: {
          street: "Avenida Paulista",
          streetNumber: "1000",
          complement: "Sala 1",
          zipCode: "01310-100",
          neighborhood: "Bela Vista",
          city: "Sao Paulo",
          state: "SP",
          country: "BR"
        }
      },
      shipping: {
        fee: 0,
        address: {
          street: "Avenida Paulista",
          streetNumber: "1000",
          complement: "Sala 1",
          zipCode: "01310-100",
          neighborhood: "Bela Vista",
          city: "Sao Paulo",
          state: "SP",
          country: "BR"
        }
      },
      items: [
        {
          title: title,
          unitPrice: amountInCents,
          quantity: 1,
          tangible: false,
          externalRef: `item-${Date.now()}`
        }
      ],
      pix: {
        expiresInDays: 1
      }
    };

    const response = await fetch(TECHBYNET_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": TECHBYNET_KEY,
        "User-Agent": USER_AGENT,
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
          error: resData.message || "Erro ao gerar cobrança no gateway Bynet",
          details: resData
        })
      };
    }

    const tx = resData.data || {};
    const qrCode = tx.qrCode || (tx.pix && tx.pix.qrcode) || "";
    const txId = tx.id || resData.transactionId || "";

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        transactionId: txId,
        id: txId,
        qrCode: qrCode,
        pixCopiaECola: qrCode,
        status: tx.status || "WAITING_PAYMENT",
        data: tx
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
