import playwright from 'playwright';
import dotenv from 'dotenv';
dotenv.config();

let browser = await playwright.chromium.launch({ headless: false });
let context = await browser.newContext();
let page = await context.newPage();

async function signin(): Promise<boolean> {
    console.log("Signing in")

    await page.goto('https://www.myworkday.com/bentley/d/home.htmld');
    await page.waitForSelector('text=Bentley Faculty, Staff and Students');

    await page.click('text=Bentley Faculty, Staff and Students');

    await page.waitForSelector('text=Sign In');

    let username = process.env.USER;
    let password = process.env.PASS;

    if (username && password) {
        await page.type('input[type=email]', username);

        await page.click("input[type=submit]");

        await page.type('input[type=password]', password);

        await page.click('input[type=submit]');

        await page.waitForTimeout(500);
    } else {
        console.log("No username or password");
        return true;
    }

    if (JSON.stringify(await page.$$("div[role=heading]")) != "[]") {
        console.log("Manual intervention required");
    }

    await page.waitForURL("https://www.myworkday.com/bentley/login-saml.htmld", { timeout: 120000 })

    if (page.url() == "https://www.myworkday.com/bentley/login-saml.htmld") {
        console.log("Login Success");
        return false;
    }
    return true;
}

async function goToPage(): Promise<boolean> {
    let err = true;

    await page.click("text='Academics'");

    await page.click("text='More (3)'");

    await page.click("text='View My Saved Schedules'")

    await page.waitForSelector("input[dir='ltr']");

    await page.click("input[dir='ltr']")

    await page.click("div[data-uxi-multiselectlistitem-index='1']")

    await page.click("text='" + process.env.COURSE + "'")

    await page.waitForTimeout(100)

    await page.click("button[title='OK']")

    let urlRegex = /\/bentley\/d\/gateway\.htmld/g
    await page.waitForURL(urlRegex, { timeout: 4000 })
        .then(() => {
            console.log("Got to registration page");
            err = false
        })

    return err
}

async function monitor(): Promise<string> {
    let registerButton = await page.$$("text='Start Registration'")

    if (JSON.stringify(registerButton) != "[]") {
        console.log("Registration open... Registering")
        await page.click("text='Start Registration'")

        await page.waitForTimeout(500)
        await page.click("text='Register'")

        await page.waitForLoadState("domcontentloaded")

        if (JSON.stringify(await page.$$("text=Unsuccessful Registrations")) != "[]") {
            console.log("Complete registration failed");
            return "fail";
        } else {
            return "success"
        }
    } else {
        console.log("Registration not started");
        await page.reload();
        await page.waitForTimeout(1000)
        await page.waitForSelector("span[data-automation-id=pageHeaderTitleText]")
        return "monitor"
    }
}

(async () => {
    let err = await signin();
    if (err) return
    err = await goToPage()
    if (err) return
    let res = await monitor()

    switch (res) {
        case "success":
            console.log("Registration successful");
            break;
        case "fail":
            console.log("Registration partially or completely failed");
            break;
        case "monitor":
            console.log("Monitoring registration");
            while (res == "monitor") {
                res = await monitor()
            }
            break;
    }
})();