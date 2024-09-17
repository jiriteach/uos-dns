// src/index.js
var BadRequestException = class extends Error {
  constructor(reason) {
    super(reason);
    this.status = 400;
    this.statusText = "Bad Request";
  }
};
var CloudflareApiException = class extends Error {
  constructor(reason) {
    super(reason);
    this.status = 500;
    this.statusText = "Internal Server Error";
  }
};
var Cloudflare = class {
  constructor(options) {
    this.cloudflare_url = "https://api.cloudflare.com/client/v4";
    this.token = options.token;
  }
  async findZone(name) {
    const response = await this._fetchWithToken(`zones?name=${name}`);
    const body = await response.json();
    if (!body.success || body.result.length === 0) {
      throw new CloudflareApiException(`Failed To Find Zone - '${name}'`);
    }
    return body.result[0];
  }
  async findRecord(zone, name, isIPV4 = true) {
    const rrType = isIPV4 ? "A" : "AAAA";
    const response = await this._fetchWithToken(`zones/${zone.id}/dns_records?name=${name}`);
    const body = await response.json();
    if (!body.success || body.result.length === 0) {
      throw new CloudflareApiException(`Failed To Find DNS Record - '${name}'`);
    }
    return body.result?.filter((rr) => rr.type === rrType)[0];
  }
  async updateRecord(record, value) {
    record.content = value;
    const response = await this._fetchWithToken(
      `zones/${record.zone_id}/dns_records/${record.id}`,
      {
        method: "PUT",
        body: JSON.stringify(record)
      }
    );
    const body = await response.json();
    if (!body.success) {
      throw new CloudflareApiException("Failed To Update DNS Record");
    }
    return body.result[0];
  }
  async _fetchWithToken(endpoint, options = {}) {
    const url = `${this.cloudflare_url}/${endpoint}`;
    options.headers = {
      ...options.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.token}`
    };
    return fetch(url, options);
  }
};

var telegramBotToken = "";
var telegramChatId = "";

function requireHttps(request) {
  const { protocol } = new URL(request.url);
  const forwardedProtocol = request.headers.get("x-forwarded-proto");
  if (protocol !== "https:" || forwardedProtocol !== "https") {
    throw new BadRequestException("Please Use HTTPS Connection");
  }
}

function parseBasicAuth(request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization)
    return {};
  const [, data] = authorization?.split(" ");
  const decoded = atob(data);
  const index = decoded.indexOf(":");
  if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
    throw new BadRequestException("Invalid Authorization Token");
  }
  return {
    username: decoded?.substring(0, index),
    password: decoded?.substring(index + 1)
  };
}

async function handleRequest(request) {
  requireHttps(request);
  const { pathname } = new URL(request.url);
  if (pathname === "/favicon.ico" || pathname === "/robots.txt") {
    return new Response(null, { status: 204 });
  }
  if (!pathname.endsWith("/update")) {
    return new Response("Cloudflare Worker - Invalid Call. Not Found!", { status: 404 });
  }
  if (!request.headers.has("Authorization") && !request.url.includes("token=")) {
    return new Response("Cloudflare Worker - Invalid Call. Not Found!", { status: 404 });
  }
  const { username, password } = parseBasicAuth(request);
  const url = new URL(request.url);
  const params = url.searchParams;
  const token = password || params?.get("token");
  const hostnameParam = params?.get("hostname") || params?.get("host") || params?.get("domains");
  const hostnames = hostnameParam?.split(",");
  const ipsParam = params.get("ips") || params.get("ip") || params.get("myip") || request.headers.get("Cf-Connecting-Ip");
  const ips = ipsParam?.split(",");
  if (!hostnames || hostnames.length === 0 || !ips || ips.length === 0) {
    throw new BadRequestException("You Must Specify Both Hostname(s) & IP Address(es)");
  }
  for (const ip of ips) {
    await informAPI(hostnames, ip.trim(), username, token);
    await sendTelegramMessage("-----------------------------------------\nCloudflare Worker\nDNS Updater\n-----------------------------------------\n\nUDM Pro - IP Update Detected!\n\n-- IP --\n" + ip.trim() + "\n\nName - " + hostnames);
  }
  return new Response("good", {
    status: 200,
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      "Cache-Control": "no-store"
    }
  });
}

async function informAPI(hostnames, ip, name, token) {
  const cloudflare = new Cloudflare({ token });
  const isIPV4 = ip.includes(".");
  const zones = /* @__PURE__ */ new Map();
  for (const hostname of hostnames) {
    const domainName = name && hostname.endsWith(name) ? name : hostname.replace(/.*?([^.]+\.[^.]+)$/, "$1");
    if (!zones.has(domainName))
      zones.set(domainName, await cloudflare.findZone(domainName));
    const zone = zones.get(domainName);
    const record = await cloudflare.findRecord(zone, hostname, isIPV4);
    await cloudflare.updateRecord(record, ip);
  }
}

async function sendTelegramMessage(message) {
  const response = await fetch('https://api.telegram.org/bot' + telegramBotToken + '/sendMessage', {
      method: 'POST',
      headers: {  'Content-Type': 'application/json' },
      body: JSON.stringify({
          chat_id: telegramChatId,
          text: message.toString().substring(0, 4096)
      })
  })
  return response
}

var src_default = {
  async fetch(request, env, ctx) {

    telegramBotToken = env.telegramBotToken;
    telegramChatId = env.telegramChatId;

    return handleRequest(request).catch((err) => {
      console.error(err.constructor.name, err);
      const message = err.reason || err.stack || "Unknown Error";
      return new Response(message, {
        status: err.status || 500,
        statusText: err.statusText || null,
        headers: {
          "Content-Type": "text/plain;charset=UTF-8",
          "Cache-Control": "no-store",
          "Content-Length": message.length
        }
      });
    });
  }
};
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
