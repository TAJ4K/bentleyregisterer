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

    if(username && password) {  
        await page.type('input[type=email]', username);
        
        await page.click("input[type=submit]");

        await page.type('input[type=password]', password);

        await page.click('input[type=submit]');

        await page.waitForTimeout(500);
    } else {
        console.log("No username or password");
        return true;
    }


    if(await page.$$("text='Verify Your Identity'")) {
        console.log("Manual intervention required");
    }

    await page.waitForURL("https://www.myworkday.com/bentley/login-saml.htmld", { timeout: 120000})

    if(page.url() == "https://www.myworkday.com/bentley/login-saml.htmld") {
        console.log("Login Success");
        return false;
    }
    return true;
}

async function goToPage(): Promise<boolean> {
    await page.click("text=Academics");

    await page.click("text='More (3)'");

    await page.click("text='View My Saved Schedules'")

    await page.waitForSelector("text='Start Date within'");

    await page.click("div[dir=ltr]")

    await page.click("text=All")

    await page.click("text='2022 Fall Semester(09/06/2022-12/20/2022)'")

    await page.click("text=OK")

    if(page.url().includes("/bentley/d/gateway.htmld")) {
        console.log("Got to registration page");
        return false;
    }
    return true;
}

async function monitor(): Promise<string> {
    if(await page.$("[text='Start Registration']")) {
        console.log("Registration open... Registering")
        await page.click("[text='Start Registration']")

        await page.waitForSelector("text=Register")
        await page.click("text=Register")

        await page.waitForLoadState("domcontentloaded")

        if(await page.$("text=Unsuccessful Registrations")){
            console.log("Complete registration failed");
            return "fail";
        } else {
            return "success"
        }
        
        
    } else {
        console.log("Registration not started");
        await page.waitForTimeout(1200);
        await page.reload();
        return "monitor"
    }
}

(async () => {
    let err = await signin();
    if (err) return
    err = await goToPage()
    if (err) return
    let res = await monitor()
    switch (res){
        case "success":
            console.log("Registration successful");
            break;
        case "fail":
            console.log("Registration partially or completely failed");
            break;
        case "monitor":
            console.log("Monitoring registration");
            break;
    }

})();