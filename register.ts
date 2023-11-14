import playwright from "playwright";
import dotenv from "dotenv";
dotenv.config({ path: "./dist/.env" });

class Script {
  private browser!: playwright.Browser;
  private context!: playwright.BrowserContext;
  private page!: playwright.Page;
  private course: string;
  private username: string;
  private password: string;

  constructor(username: string, password: string, course: string) {
    this.username = username;
    this.password = password;
    this.course = course;
  }

  private async init(): Promise<void> {
    this.browser = await playwright.chromium.launch({ headless: false });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();
  }

  private async signin(): Promise<boolean> {
    console.log("Signing in");

    await this.page.goto("https://www.myworkday.com/bentley/d/home.htmld");
    await this.page.waitForSelector(
      "text='Bentley Faculty, Staff and Students'"
    );

    await this.page.click("text='Bentley Faculty, Staff and Students'");

    await this.page.waitForSelector("text=Sign In");

    await this.page.type("input[type=email]", this.username);

    await this.page.click("input[type=submit]");

    await this.page.type("input[type=password]", this.password);

    await this.page.click("input[type=submit]");

    await this.page.waitForTimeout(500);

    if (JSON.stringify(await this.page.$$("div[role=heading]")) != "[]") {
      console.log("Manual intervention required");
    }

    await this.page.waitForURL(
      "https://www.myworkday.com/bentley/login-saml.htmld",
      { timeout: 120000 }
    );

    // fluff code because i've had issues with waitForURL before
    if (
      this.page.url() == "https://www.myworkday.com/bentley/login-saml.htmld"
    ) {
      console.log("Login Success");
      return false;
    }
    return true;
  }

  private async goToPage(): Promise<boolean> {
    let err = true;

    await this.page.click("button[aria-label='Academics']");

    await this.page.click("text='More (3)'");

    await this.page.click("text='View My Saved Schedules'");

    await this.page.waitForSelector("input[dir='ltr']");

    await this.page.click("input[dir='ltr']", { delay: 500 });

    await this.page.click("div[data-uxi-multiselectlistitem-index='1']", {
      delay: 500,
    });

    if (this.course == "latest") {
      await this.page.waitForSelector("div[role=listbox]>div");
      const parent = await this.page.$$("div[role=listbox]>div>div");

      let semesters: string[] = [];
      for (let i = 0; i < parent.length; i++) {
        let text = await this.page.evaluate((el) => el.textContent, parent[i]);
        if (text != null) semesters.push(text);
      }

      //Array.prototype.reverse() modifies the given array and returns a pointer back to it
      //Have to duplicate the array in order to keep the originial intact
      let reversed = semesters.map((x) => x);
      reversed.reverse();

      if (semesters.length == 1)
        await this.page.click("div[role=listbox]>div>div:nth-child(1)");
      else {
        for (let i = 0; i < semesters.length - 1; i++) {
          if (reversed[i].substring(0, 5) > reversed[i + 1].substring(0, 5)) {
            let index = semesters.indexOf(reversed[i]);
            await this.page.click(
              `div[role=listbox]>div>div:nth-child(${index + 1})`,
              { delay: 500 }
            );
            break;
          }
        }
      }
    } else {
      await this.page.click("text='" + this.course + "'");
    }

    await this.page.waitForTimeout(500);

    await this.page.click("button[title='OK']");

    const urlRegex = /\/bentley\/d\/gateway\.htmld/g;
    await this.page.waitForURL(urlRegex, { timeout: 99000 }).then(() => {
      console.log("Got to registration page");
      err = false;
    });

    return err;
  }

  private async monitor(): Promise<string> {
    const registerButton = await this.page.$$("text='Start Registration'");

    if (JSON.stringify(registerButton) != "[]") {
      console.log("Registration open... Registering");
      await this.page.click("text='Start Registration'");

      await this.page.waitForSelector("text='Register'");
      await this.page.click("text='Register'");

      await this.page.waitForLoadState("domcontentloaded");

      if (
        JSON.stringify(
          await this.page.$$("text='Unsuccessful Registrations'")
        ) != "[]"
      ) {
        console.log("Complete registration failed");
        return "fail";
      } else {
        return "success";
      }
    } else {
      //refreshes and checks again
      console.log("Registration not started");
      await this.page.reload();
      await this.page.waitForTimeout(1000);
      await this.page.waitForSelector(
        "span[data-automation-id=pageHeaderTitleText]"
      );
      return "monitor";
    }
  }

  public async run(): Promise<void> {
    await this.init();
    let err = await this.signin();
    if (err) return;
    err = await this.goToPage();
    if (err) return;

    let res = "monitor";
    while (res == "monitor") {
      res = await this.monitor();
      switch (res) {
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
    }
  }
}

const launch = () => {
  let username = process.env.EMAIL;
  let password = process.env.PASS;
  let course = process.env.COURSE;

  if (!username || !password || !course) {
    console.log("Missing or empty environment variables, please check .env");
    return;
  }

  const script = new Script(username, password, course);
  script.run();
};

launch();
