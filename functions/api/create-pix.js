const XPAY_KEY = "cpk_live_ex84lopcp2xexagmazz6za11";

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-API-KEY, Authorization"
    }
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const res = await fetch("https://api.xpaybrasil.com/v1/charge/pix", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": XPAY_KEY
      },
      body: JSON.stringify(body)
    });

    const data = await res.text();
    return new Response(data, {
      status: res.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}
