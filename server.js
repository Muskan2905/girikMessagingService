const express = require('express');
const path    = require('path');
const https   = require('https');
const http    = require('http');
const app     = express();

app.use(express.json());

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ─── CONFIG ───────────────────────────────────────────────────────────────────
app.get('/config.json', (req, res) => {
    res.json({
        "workflowApiVersion": "1.1",
        "metaData": {
            "icon": "https://res.cloudinary.com/dwdj0l58l/image/upload/v1771527602/icons8-threads-50_i5bnnj.png",
            "smallIcon": "https://res.cloudinary.com/dwdj0l58l/image/upload/v1771527602/icons8-threads-50_i5bnnj.png",
            "category": "message"
        },
        "type": "REST",
        "lang": {
            "en-US": {
                "name": "iThreads Post",
                "description": "Send a WhatsApp message per contact via Twilio"
            }
        },
        "arguments": {
            "execute": {
                "inArguments": [],
                "url": "https://ithreads.onrender.com/execute",
                "verb": "POST",
                "body": "",
                "header": "",
                "format": "json",
                "timeout": 10000,
                "retryCount": 2,
                "retryDelay": 1000,
                "concurrentRequests": 5
            }
        },
        "configurationArguments": {
            "save": {
                "url": "https://ithreads.onrender.com/save",
                "verb": "POST"
            },
            "validate": {
                "url": "https://ithreads.onrender.com/validate",
                "verb": "POST"
            },
            "publish": {
                "url": "https://ithreads.onrender.com/publish",
                "verb": "POST"
            },
            "stop": {
                "url": "https://ithreads.onrender.com/stop",
                "verb": "POST"
            }
        },
        "userInterfaces": {
            "configModal": {
                "url": "https://mc97sb5jfx5jwlk8yysdds5268h1.pub.sfmc-content.com/ubeqynah3n3",
                "width": 800,
                "height": 600
            }
        }
    });
});

// ─── LIFECYCLE ENDPOINTS ──────────────────────────────────────────────────────

app.post('/save', (req, res) => {
    console.log("SAVE:", JSON.stringify(req.body, null, 2));
    res.status(200).json({ success: true });
});

app.post('/validate', (req, res) => {
    console.log("VALIDATE:", JSON.stringify(req.body, null, 2));
    const inArgs = req.body?.arguments?.execute?.inArguments?.[0];
    if (!inArgs?.messageTitle) {
        return res.status(200).json({ success: false, message: "Message Title is required" });
    }
    if (!inArgs?.fromPhoneNumber || !inArgs?.toPhoneNumber) {
        return res.status(200).json({ success: false, message: "Phone number fields must be mapped" });
    }
    res.status(200).json({ success: true });
});

app.post('/publish', (req, res) => {
    console.log("PUBLISH:", JSON.stringify(req.body, null, 2));
    res.status(200).json({ success: true });
});

app.post('/stop', (req, res) => {
    console.log("STOP:", JSON.stringify(req.body, null, 2));
    res.status(200).json({ success: true });
});

// ─── EXECUTE ──────────────────────────────────────────────────────────────────
// Journey Builder calls this once per contact.
// By the time it arrives here, SFMC has already resolved all {{Contact.Attribute.*}}
// bindings — so fromPhoneNumber, toPhoneNumber, messageBody are real values.
//
// We then POST those resolved values to the SSJS CloudPage, which handles
// the actual Twilio WhatsApp send + DE logging.

app.post('/execute', async (req, res) => {
    console.log("EXECUTE:", JSON.stringify(req.body, null, 2));

    try {
        const inArgs = req.body?.inArguments?.[0];

        if (!inArgs) {
            console.error("No inArguments in execute payload");
            return res.status(200).json({ success: false, message: "No inArguments" });
        }

        // These values are now fully resolved per-contact by SFMC
        const messageTitle    = inArgs.messageTitle    || '';
        const fromPhoneNumber = inArgs.fromPhoneNumber || '';
        const toPhoneNumber   = inArgs.toPhoneNumber   || '';
        const messageBody     = inArgs.messageBody     || '';

        console.log(`Contact — Title: ${messageTitle}, From: ${fromPhoneNumber}, To: ${toPhoneNumber}`);

        if (!toPhoneNumber || !fromPhoneNumber) {
            console.error("Missing phone numbers in resolved inArguments");
            return res.status(200).json({ success: false, message: "Phone number fields are empty after resolution" });
        }

        // ── Call the SSJS CloudPage ──────────────────────────────────────────
        // The SSJS page reads these POST parameters and calls Twilio + logs to DE.
        const ssjs_result = await callSsjsCloudPage({
            messageTitle,
            fromPhoneNumber,
            toPhoneNumber,
            messageBody
        });

        console.log("SSJS CloudPage response:", ssjs_result);

        res.status(200).json({ success: true, ssjs: ssjs_result });

    } catch (err) {
        console.error("EXECUTE error:", err);
        res.status(200).json({ success: false, message: err.message });
    }
});

// ─── HELPER: POST to SSJS CloudPage ──────────────────────────────────────────
/**
 * Sends a URL-encoded POST to your SSJS CloudPage.
 * The CloudPage reads Request.GetFormField() for each param,
 * builds the Twilio payload, sends the WhatsApp message, and logs to your DE.
 *
 * Replace SSJS_CLOUDPAGE_URL with the actual URL of your SSJS execution page.
 */
function callSsjsCloudPage(params) {
    return new Promise((resolve, reject) => {

        // ── REPLACE this URL with your actual SSJS execution CloudPage URL ──
        const SSJS_CLOUDPAGE_URL = 'https://mc97sb5jfx5jwlk8yysdds5268h1.pub.sfmc-content.com/ak2mph3gijc';

        const body = Object.entries(params)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');

        const urlObj = new URL(SSJS_CLOUDPAGE_URL);
        const isHttps = urlObj.protocol === 'https:';
        const lib = isHttps ? https : http;

        const options = {
            hostname: urlObj.hostname,
            path:     urlObj.pathname + urlObj.search,
            method:   'POST',
            headers: {
                'Content-Type':   'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const request = lib.request(options, (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => resolve({ statusCode: response.statusCode, body: data }));
        });

        request.on('error', reject);
        request.setTimeout(9000, () => {
            request.destroy();
            reject(new Error('SSJS CloudPage request timed out'));
        });

        request.write(body);
        request.end();
    });
}

// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.status(200).json({ status: 'iThreads backend running' });
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`iThreads backend on port ${PORT}`));
