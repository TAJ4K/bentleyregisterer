import playwright from 'playwright';
import dotenv from 'dotenv';
dotenv.config();

//not my favorite stuff to keep in a global context, but it works
let browser: playwright.Browser = await playwright.chromium.launch({ headless: false});
let context: playwright.BrowserContext = await browser.newContext();
let page: playwright.Page = await context.newPage();

async function signin(): Promise<boolean> {
    console.log("Signing in")

    await page.goto('https://www.myworkday.com/bentley/d/home.htmld');
    await page.waitForSelector("text='Bentley Faculty, Staff and Students'");

    await page.click("text='Bentley Faculty, Staff and Students'");

    await page.waitForSelector('text=Sign In');

    let username = process.env.USER;
    let password = process.env.PASS;

    if (!username || !password) return true

    await page.type('input[type=email]', username);

    await page.click("input[type=submit]");

    await page.type('input[type=password]', password);

    await page.click('input[type=submit]');

    await page.waitForTimeout(500);

    if (JSON.stringify(await page.$$("div[role=heading]")) != "[]") {
        console.log("Manual intervention required");
    }

    await page.waitForURL("https://www.myworkday.com/bentley/login-saml.htmld", { timeout: 120000 })

    //fluff code because i've had issues with waitForURL before
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

    await page.click("input[dir='ltr']", { delay: 500 })

    await page.click("div[data-uxi-multiselectlistitem-index='1']", { delay: 500 })

    let course = process.env.COURSE
    if (!course) return err

    if (course == "latest") {
        await page.waitForSelector("div[role=listbox]>div")
        let parent = await page.$$("div[role=listbox]>div>div")

        let last = await parent[parent.length - 1].textContent()
        let secondLast = await parent[parent.length - 2].textContent()
        // added + 1 to account for nth-child indexing starting at 1, it makes more sense in my head
        if (secondLast?.substring(0, 5) == last?.substring(0, 5)) {
            await page.click(`div[role=listbox]>div>div:nth-child(${parent.length - 2 + 1})`, { delay: 500 })
        } else {
            await page.click(`div[role=listbox]>div>div:nth-child(${parent.length - 1 + 1})`, { delay: 500 })
        }
    } else {
        await page.click("text='" + course + "'")
    }

    await page.waitForTimeout(500)

    await page.click("button[title='OK']")

    let urlRegex = /\/bentley\/d\/gateway\.htmld/g
    await page.waitForURL(urlRegex, { timeout: 99000 })
        .then(() => {
            console.log("Got to registration page");
            err = false
        })

    return err
}

async function monitor(): Promise<string> {
    let registerButton = await page.$$("text='Start Registration'")

    if (JSON.stringify(registerButton) != "[]") {
        //all speculative code based off a couple images, not sure if it's correct
        console.log("Registration open... Registering")
        await page.click("text='Start Registration'")

        await page.waitForTimeout(500)
        await page.click("text='Register'")

        await page.waitForLoadState("domcontentloaded")

        if (JSON.stringify(await page.$$("text='Unsuccessful Registrations'")) != "[]") {
            console.log("Complete registration failed");
            return "fail";
        } else {
            return "success"
        }
    } else {
        //refreshes and checks again
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
            //starts monitoring loop
            while (res == "monitor") {
                res = await monitor()
            }
            break;
    }
})();