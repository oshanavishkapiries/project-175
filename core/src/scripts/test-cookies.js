/**
 * Cookie Loading Test - Raw Playwright Test (No LLM)
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

async function testCookies() {
    console.log('\n=== Cookie Loading Test ===\n');

    // Base data directory - respects DATA_DIR environment variable
    const baseDataDir = process.env.DATA_DIR
        ? path.resolve(process.env.DATA_DIR)
        : path.join(__dirname, '..', '..', 'data');

    const cookiesDir = path.join(baseDataDir, 'cookies');
    const cookieFile = path.join(cookiesDir, 'linkedin.com.json');

    // 1. Check cookie file
    console.log('[1] Checking cookie file...');
    if (!fs.existsSync(cookieFile)) {
        console.log('❌ Cookie file not found:', cookieFile);
        return;
    }
    console.log('✓ Found:', cookieFile);

    // 2. Parse cookies
    console.log('\n[2] Parsing cookies...');
    let cookies;
    try {
        cookies = JSON.parse(fs.readFileSync(cookieFile, 'utf8'));
        console.log('✓ Loaded', cookies.length, 'cookies');
    } catch (e) {
        console.log('❌ Parse error:', e.message);
        return;
    }

    // 3. Show cookies
    console.log('\n[3] Cookie details:');
    cookies.forEach((c, i) => {
        const isSession = c.name === 'li_at';
        console.log(`   ${isSession ? '⭐' : '  '} ${c.name} = ${c.value.substring(0, 30)}...`);
        console.log(`      domain: ${c.domain}, path: ${c.path || '/'}`);
    });

    // Check for session cookie
    const hasSession = cookies.some(c => c.name === 'li_at');
    if (!hasSession) {
        console.log('\n⚠️  WARNING: No "li_at" cookie found - this is needed for login!');
    }

    // 4. Launch browser (using system Chrome)
    console.log('\n[4] Launching browser...');
    const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

    const browser = await chromium.launch({
        headless: false,
        executablePath: chromePath,
        args: ['--disable-blink-features=AutomationControlled']
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    console.log('✓ Browser ready (using system Chrome)');

    // 5. Add cookies BEFORE navigation
    console.log('\n[5] Adding cookies to browser...');
    try {
        // Transform cookies to Playwright format
        const playwrightCookies = cookies.map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || '/',
            expires: c.expires || c.expirationDate || -1,
            httpOnly: c.httpOnly || false,
            secure: c.secure || false,
            sameSite: c.sameSite === 'no_restriction' ? 'None' :
                c.sameSite === 'lax' ? 'Lax' :
                    c.sameSite === 'strict' ? 'Strict' : 'None'
        }));

        await context.addCookies(playwrightCookies);
        console.log('✓ Cookies added (' + playwrightCookies.length + ' cookies)');
    } catch (e) {
        console.log('❌ Error adding cookies:', e.message);
        await browser.close();
        return;
    }

    // 6. Navigate to LinkedIn
    console.log('\n[6] Navigating to LinkedIn...');
    await page.goto('https://www.linkedin.com/feed/', {
        waitUntil: 'domcontentloaded',
        timeout: 30000
    });
    await page.waitForTimeout(3000);

    const url = page.url();
    console.log('   Current URL:', url);

    // 7. Check result
    console.log('\n[7] Result:');
    if (url.includes('/login') || url.includes('/authwall') || url.includes('/uas/')) {
        console.log('❌ NOT LOGGED IN - Cookies did not work');
        console.log('   You need to export fresh cookies from your browser');
    } else if (url.includes('/feed')) {
        console.log('✓ SUCCESS! You are logged in!');
    } else {
        console.log('? Unknown page:', url);
    }

    // 8. Check browser cookies
    console.log('\n[8] Browser cookies for linkedin.com:');
    const browserCookies = await context.cookies(['https://www.linkedin.com']);
    console.log('   Total:', browserCookies.length, 'cookies');
    const li_at = browserCookies.find(c => c.name === 'li_at');
    console.log('   li_at present:', li_at ? 'YES' : 'NO');

    // Screenshot
    const ssPath = path.join(baseDataDir, 'cookie-test.png');
    await page.screenshot({ path: ssPath });
    console.log('\n[9] Screenshot saved:', ssPath);

    console.log('\n=== Browser open for inspection. Ctrl+C to close ===\n');
    await new Promise(() => { });
}

testCookies().catch(console.error);
