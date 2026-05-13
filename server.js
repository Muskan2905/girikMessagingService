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

// ─── SFMC CREDENTIALS ─────────────────────────────────────────────────────────
const SFMC_CLIENT_ID     = '4mjcni9capeumlxvreujs3fx';
const SFMC_CLIENT_SECRET = 'SFMC_XxDYw5qbruA8UrQFu0C2Wvx5sizZfbrM48M5qSY8gZvGJMvDlGf0cfd9387';
const SFMC_MID           = '10966026';       // replace with your actual MID
const SFMC_SUBDOMAIN     = 'mc97sb5jfx5jwlk8yysdds5268h1';
const SFMC_DE_EXTERNAL_KEY = 'FC88FEB4-78E7-409F-AB25-25177C4F9EB1'; // Twilio Test SMS Audience

// ─── SFMC TOKEN CACHE ─────────────────────────────────────────────────────────
let sfmcToken = null;
let sfmcTokenExpiry = 0;

async function getSfmcToken() {
    const now = Date.now();
    if (sfmcToken && now < sfmcTokenExpiry) {
        return sfmcToken;
    }

    const body = JSON.stringify({
        grant_type:    'client_credentials',
        client_id:     SFMC_CLIENT_ID,
        client_secret: SFMC_CLIENT_SECRET,
        account_id:    SFMC_MID
    });

    return new Promise((resolve, reject) => {
        const options = {
            hostname: `${SFMC_SUBDOMAIN}.auth.marketingcloudapis.com`,
            path:     '/v2/token',
            method:   'POST',
            headers: {
                'Content-Type':   'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    if (!parsed.access_token) {
                        return reject(new Error('No access_token in response: ' + data));
                    }
                    sfmcToken = parsed.access_token;
                    // expire 5 min before actual expiry
                    sfmcTokenExpiry = Date.now() + ((parsed.expires_in - 300) * 1000);
                    console.log('SFMC token obtained successfully');
                    resolve(sfmcToken);
                } catch (e) {
                    reject(new Error('Token parse error: ' + e.message));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

// ─── LOOKUP CONTACT IN DE ─────────────────────────────────────────────────────
async function lookupContactInDE(contactKey) {
    const token = await getSfmcToken();

    // Use SFMC REST API to query the DE by Name (subscriber key)
    //const filter = encodeURIComponent(`Name=${contactKey}`);
    // NEW - correct SFMC filter syntax
    const apiPath  = `/data/v1/customobjectdata/key/${SFMC_DE_EXTERNAL_KEY}/rowset?$filter=Name%20eq%20%27${encodeURIComponent(contactKey)}%27`;

    return new Promise((resolve, reject) => {
        const options = {
            hostname: `${SFMC_SUBDOMAIN}.rest.marketingcloudapis.com`,
            path:     apiPath,
            method:   'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type':  'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    console.log('DE lookup raw response:', data);
                    const parsed = JSON.parse(data);

                    console.log('Total items found:', parsed.count || parsed.items?.length);
                    console.log('Parsed keys:', Object.keys(parsed));

                    // Response has items array
                    const items = parsed.items || [];
                    if (items.length === 0) {
                        return reject(new Error(`No DE row found for contactKey: ${contactKey}`));
                    }

                    // Field values are in the values object
                    const values = items[0].values || {};
                    console.log('DE row values:', JSON.stringify(values));

                    resolve({
                        name:            values.name            || '',
                        FromPhoneNumber: values.fromphonenumber || '',
                        ToPhoneNumber:   values.tophonenumber   || '',
                        Body:            values.body            || ''
                    });
                } catch (e) {
                    reject(new Error('DE lookup parse error: ' + e.message));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(9000, () => {
            req.destroy();
            reject(new Error('DE lookup timed out'));
        });
        req.end();
    });
}

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
            "save":     { "url": "https://ithreads.onrender.com/save",     "verb": "POST" },
            "validate": { "url": "https://ithreads.onrender.com/validate", "verb": "POST" },
            "publish":  { "url": "https://ithreads.onrender.com/publish",  "verb": "POST" },
            "stop":     { "url": "https://ithreads.onrender.com/stop",     "verb": "POST" }
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
app.post('/save',     (req, res) => { console.log("SAVE");     res.status(200).json({ success: true }); });
app.post('/publish',  (req, res) => { console.log("PUBLISH");  res.status(200).json({ success: true }); });
app.post('/stop',     (req, res) => { console.log("STOP");     res.status(200).json({ success: true }); });

app.post('/validate', (req, res) => {
    const inArgs = req.body?.arguments?.execute?.inArguments?.[0];
    if (!inArgs?.messageTitle) {
        return res.status(200).json({ success: false, message: "Message Title is required" });
    }
    res.status(200).json({ success: true });
});

// ─── EXECUTE ──────────────────────────────────────────────────────────────────
app.post('/execute', async (req, res) => {
    console.log("=== EXECUTE CALLED ===");
    console.log("FULL BODY:", JSON.stringify(req.body, null, 2));

    try {
        const inArgs = req.body?.inArguments?.[0];

        if (!inArgs) {
            console.error("No inArguments in execute payload");
            return res.status(200).json({ success: false, message: "No inArguments" });
        }

        const contactKey = inArgs.contactKey || req.body.keyValue;
        const messageTitle = inArgs.messageTitle || '';

        console.log(`contactKey: ${contactKey}`);
        console.log(`messageTitle: ${messageTitle}`);

        if (!contactKey) {
            return res.status(200).json({ success: false, message: "No contactKey in inArguments" });
        }

        // Look up contact's row in DE using SFMC REST API
        const contactData = await lookupContactInDE(contactKey);

        const fromPhoneNumber = contactData.FromPhoneNumber;
        const toPhoneNumber   = contactData.ToPhoneNumber;
        //const messageBody     = contactData.Body;
        const rawTemplate  = inArgs.templateBody || contactData.Body;
        console.log('rawTemplate:', rawTemplate);
        console.log('contactData.name:', contactData.name);
        const messageBody  = rawTemplate.replace(/{Name}/g, contactData.name || '');
        console.log('resolvedBody:', messageBody);

        console.log(`From: ${fromPhoneNumber}, To: ${toPhoneNumber}, Body: ${messageBody}`);

        if (!fromPhoneNumber || !toPhoneNumber) {
            return res.status(200).json({ success: false, message: "Phone numbers empty in DE row" });
        }

        // Call SSJS CloudPage → Twilio
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

app.get('/templates', async (req, res) => {
    try {
        const templates = await fetchTemplates();
        res.status(200).json({ success: true, templates });
    } catch (err) {
        console.error("TEMPLATES error:", err);
        res.status(200).json({ success: false, message: err.message });
    }
});

// ─── HELPER: POST to SSJS CloudPage ──────────────────────────────────────────
function callSsjsCloudPage(params) {
    return new Promise((resolve, reject) => {
        const SSJS_CLOUDPAGE_URL = 'https://mc97sb5jfx5jwlk8yysdds5268h1.pub.sfmc-content.com/ak2mph3gijc';

        const body = Object.entries(params)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');

        const urlObj = new URL(SSJS_CLOUDPAGE_URL);

        const options = {
            hostname: urlObj.hostname,
            path:     urlObj.pathname + urlObj.search,
            method:   'POST',
            headers: {
                'Content-Type':   'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(body)
            }
        };

        const request = https.request(options, (response) => {
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

async function fetchTemplates() {
    const token = await getSfmcToken();
    const TEMPLATES_DE_KEY = '6A0F8F29-E201-4064-AB1F-1986FF072B2A';

    return new Promise((resolve, reject) => {
        const options = {
            hostname: `${SFMC_SUBDOMAIN}.rest.marketingcloudapis.com`,
            path:     `/data/v1/customobjectdata/key/${TEMPLATES_DE_KEY}/rowset`,
            method:   'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type':  'application/json'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    const items = parsed.items || [];
                    const templates = items.map(item => ({
                        id:          item.values.templateid,
                        name:        item.values.templatename,
                        body:        item.values.templatebody,
                        description: item.values.description || ''
                    }));
                    resolve(templates);
                } catch (e) {
                    reject(new Error('Templates parse error: ' + e.message));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(9000, () => {
            req.destroy();
            reject(new Error('Templates fetch timed out'));
        });
        req.end();
    });
}
// ─── HEALTH ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.status(200).json({ status: 'iThreads backend running' });
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`iThreads backend on port ${PORT}`));
