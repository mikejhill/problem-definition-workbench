/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, console, process, setTimeout */

const auth = require("firebase-tools/lib/auth");
const { Client } = require("firebase-tools/lib/apiv2");
const ensureApiEnabled = require("firebase-tools/lib/ensureApiEnabled");
const { getErrStatus } = require("firebase-tools/lib/error");

const projectId = "problem-definition-workbench";
const projectNumber = "567734106058";
const repositoryId = "1320409706";
const legacyServiceAccount =
  "github-firebase-deployer@problem-definition-workbench.iam.gserviceaccount.com";
const poolId = "github-actions";
const providerId = "problem-definition-workbench";
const poolName = `projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}`;
const providerName = `${poolName}/providers/${providerId}`;

const iam = new Client({ urlPrefix: "https://iam.googleapis.com", apiVersion: "v1" });
const resourceManager = new Client({
  urlPrefix: "https://cloudresourcemanager.googleapis.com",
  apiVersion: "v1",
});

async function getOrNull(client, path) {
  try {
    return (await client.get(path)).body;
  } catch (error) {
    if (getErrStatus(error) === 404) return null;
    throw error;
  }
}

async function waitFor(client, path) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const resource = await getOrNull(client, path);
    if (resource?.state === "ACTIVE" || (resource && resource.state === undefined)) return resource;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error(`Timed out waiting for ${path}`);
}

function mergeBinding(policy, role, member) {
  policy.bindings ??= [];
  let binding = policy.bindings.find((candidate) => candidate.role === role);
  if (!binding) {
    binding = { role, members: [] };
    policy.bindings.push(binding);
  }
  binding.members ??= [];
  if (!binding.members.includes(member)) binding.members.push(member);
}

function removeMember(policy, member) {
  for (const binding of policy.bindings ?? []) {
    binding.members = (binding.members ?? []).filter((candidate) => candidate !== member);
  }
  policy.bindings = (policy.bindings ?? []).filter((binding) => binding.members.length > 0);
}

async function main() {
  const account = auth.getGlobalDefaultAccount();
  if (!account) throw new Error("Run firebase login before provisioning workload identity.");
  auth.setActiveAccount({}, account);

  await Promise.all(
    ["iam.googleapis.com", "iamcredentials.googleapis.com", "sts.googleapis.com"].map((api) =>
      ensureApiEnabled.ensure(projectId, api, "oidc", true),
    ),
  );

  if (!(await getOrNull(iam, poolName))) {
    await iam.post(
      `projects/${projectNumber}/locations/global/workloadIdentityPools`,
      {
        displayName: "GitHub Actions",
        description: "OIDC identities for the Problem Definition Workbench repository.",
      },
      { queryParams: { workloadIdentityPoolId: poolId } },
    );
    await waitFor(iam, poolName);
  }

  if (!(await getOrNull(iam, providerName))) {
    await iam.post(
      `${poolName}/providers`,
      {
        displayName: "Problem Definition Workbench",
        description: "Main-branch deployments from mikejhill/problem-definition-workbench.",
        attributeMapping: {
          "google.subject": "assertion.sub",
          "attribute.repository_id": "assertion.repository_id",
          "attribute.ref": "assertion.ref",
        },
        attributeCondition: `assertion.repository_id == '${repositoryId}' && assertion.ref == 'refs/heads/main'`,
        oidc: { issuerUri: "https://token.actions.githubusercontent.com" },
      },
      { queryParams: { workloadIdentityPoolProviderId: providerId } },
    );
    await waitFor(iam, providerName);
  }

  const projectPolicy = (await resourceManager.post(`projects/${projectId}:getIamPolicy`, {})).body;
  const repositoryPrincipal = `principalSet://iam.googleapis.com/${poolName}/attribute.repository_id/${repositoryId}`;
  removeMember(projectPolicy, `serviceAccount:${legacyServiceAccount}`);
  for (const role of [
    "roles/firebaserules.admin",
    "roles/datastore.indexAdmin",
    "roles/firebase.viewer",
    "roles/serviceusage.serviceUsageConsumer",
    "roles/serviceusage.serviceUsageViewer",
  ]) {
    mergeBinding(projectPolicy, role, repositoryPrincipal);
  }
  await resourceManager.post(`projects/${projectId}:setIamPolicy`, { policy: projectPolicy });

  console.log(JSON.stringify({ providerName, repositoryPrincipal }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
