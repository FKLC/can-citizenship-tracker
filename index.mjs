import fs from "fs/promises";
import DeepDiff from "deep-diff";

async function readConfig() {
  const contents = await fs.readFile("config.json", { encoding: "utf-8" });
  return JSON.parse(contents);
}

async function writeConfig(config) {
  await fs.writeFile("config.json", JSON.stringify(config, null, 2));
}

async function login(username, password) {
  return fetch("https://cognito-idp.ca-central-1.amazonaws.com/", {
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
    },
    body: JSON.stringify({
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: "mtnf1qn9p739g2v8aij2anpju",
      AuthParameters: {
        USERNAME: username,
        PASSWORD: password,
      },
    }),
    method: "POST",
  })
    .then((r) => r.json())
    .then((r) => r.AuthenticationResult.IdToken);
}

async function getStatus(token) {
  const summary = await fetch("https://api.tracker-suivi.apps.cic.gc.ca/user", {
    headers: {
      Authorization: "Bearer " + token,
    },
    body: '{"method":"get-profile-summary","limit":"500"}',
    method: "POST",
  }).then((r) => r.json());

  const apps = [];
  for (const { appNumber } of summary.apps) {
    apps.push(
      await fetch("https://api.tracker-suivi.apps.cic.gc.ca/user", {
        headers: {
          Authorization: "Bearer " + token,
        },
        body: `{"method":"get-application-details","applicationNumber":"${appNumber}"}`,
        method: "POST",
      }).then((r) => r.json())
    );
  }

  return {
    summary,
    apps,
  };
}

async function main() {
  const config = await readConfig();

  const token = await login(config.username, config.password);
  const status = await getStatus(token);

  const diff = DeepDiff(config.status || {}, status);
  if (diff) {
    console.log("Status changed!");
    console.log(JSON.stringify(diff, null, 2));
    config.status = status;
    await writeConfig(config);
  } else {
    console.log("No changes.");
  }
}

main();
