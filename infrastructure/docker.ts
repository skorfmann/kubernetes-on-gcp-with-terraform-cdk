import { TerraformAsset } from "cdktf";
import { Construct } from "constructs";
import * as fs from "fs";
import * as path from "path";
import { VERSION, DOCKER_ORG } from "./config";
import { Resource } from "./.gen/providers/null/resource";
import { GoogleContainerRegistry } from './lib';

export function buildAndPushImage(
  scope: Construct,
  imageName: string,
  p: string
): [string, Resource] {
  const _ = (name: string) => `${imageName}-${name}`;
  const files = fs.readdirSync(p);

  function getDockerfileFlag() {
    if (files.includes("Dockerfile")) {
      return "";
    }

    if (files.includes("package.json")) {
      const asset = new TerraformAsset(scope, _("node-dockerfile"), {
        path: path.resolve(__dirname, "Dockerfile.node"),
      });

      return `-f ${asset.path}`;
    }

    if (files.includes("Cargo.toml")) {
      const asset = new TerraformAsset(scope, _("node-dockerfile"), {
        path: path.resolve(__dirname, "Dockerfile.rust"),
      });

      return `-f ${asset.path}`;
    }

    throw new Error(
      "Unknown application language, please add a Dockerfile or use node or rust"
    );
  }

  function getVersion(): string {
    if (files.includes("package.json")) {
      return require(path.resolve(p, "package.json")).version;
    }

    return VERSION;
  }

  const dockerfileFlag = getDockerfileFlag();
  const content = new TerraformAsset(scope, _("content"), {
    path: p,
  });

  const key = GoogleContainerRegistry.from(scope).addKey()

  const version = getVersion();

  const tag = `gcr.io/${DOCKER_ORG}/${imageName}:${version}-${content.assetHash}`; // move this into GoogleContainerRegistry ; e.g. registry.imageUri(name, tag)

  // would it make sense to have something like registry.buildAndPush(imageName, tag, dockerfile, path)
  const image = new Resource(scope, _("image"), {
    triggers: {
      tag,
    },
  });

  const cmd = `echo '${key.privateKey}' | base64 -D | docker login -u _json_key --password-stdin https://gcr.io && docker build ${dockerfileFlag} -t ${tag} ${content.path} && docker push ${tag}`;
  image.addOverride("provisioner.local-exec.command", cmd);

  return [tag, image];
}
