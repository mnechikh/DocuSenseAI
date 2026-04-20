import { NextResponse } from "next/server";

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lumxia API Reference</title>
    <link
      rel="stylesheet"
      href="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui.css"
    />
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; background: #ffffff; font-family: sans-serif; }

      /* Hide the default Swagger top bar */
      .swagger-ui .topbar { display: none !important; }

      /* Custom header */
      #lumxia-header {
        background: linear-gradient(135deg, #7C8CFF 0%, #9B8CFF 50%, #C084FC 100%);
        padding: 18px 24px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      #lumxia-header .dot {
        width: 32px; height: 32px; border-radius: 10px;
        background: rgba(255,255,255,0.15);
        display: flex; align-items: center; justify-content: center;
      }
      #lumxia-header .dot-inner {
        width: 9px; height: 9px; border-radius: 50%;
        background: rgba(255,255,255,0.95);
        box-shadow: 0 0 6px 3px rgba(255,255,255,0.5);
      }
      #lumxia-header h1 {
        margin: 0; color: white; font-size: 18px; font-weight: 700; letter-spacing: -0.3px;
      }
      #lumxia-header span {
        color: rgba(255,255,255,0.6); font-size: 12px; letter-spacing: 2px;
        text-transform: uppercase; font-weight: 600; margin-left: 2px;
      }

      /* Tweak Swagger UI colors */
      .swagger-ui .info .title { color: #1e1b4b; }
      .swagger-ui .opblock-tag { color: #4338ca; }
      .swagger-ui .scheme-container { background: #f8f7ff; }
    </style>
  </head>
  <body>
    <div id="lumxia-header">
      <div class="dot"><div class="dot-inner"></div></div>
      <div>
        <h1>Lumxia</h1>
        <span>API Reference</span>
      </div>
    </div>

    <div id="swagger-ui"></div>

    <script src="https://unpkg.com/swagger-ui-dist@5.18.2/swagger-ui-bundle.js"></script>
    <script>
      window.onload = function () {
        SwaggerUIBundle({
          url: '/api/v1/openapi.json',
          dom_id: '#swagger-ui',
          presets: [SwaggerUIBundle.presets.apis],
          layout: 'BaseLayout',
          deepLinking: true,
          defaultModelsExpandDepth: 1,
          defaultModelExpandDepth: 2,
          tryItOutEnabled: false,
          displayRequestDuration: true,
          filter: true,
          syntaxHighlight: { activated: true, theme: 'agate' },
        });
      };
    </script>
  </body>
</html>`;

export async function GET() {
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
