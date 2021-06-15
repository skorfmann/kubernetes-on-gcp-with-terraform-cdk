import { Construct } from "constructs";
import { Resource } from "cdktf";
import {
  ProjectIamMember,
  ServiceAccount,
} from "@cdktf/provider-google";

export interface IGoogleServiceAccount {
  readonly email: string;
}

export interface GoogleServiceAccountConfig {
  readonly role: string;
}

export class GoogleServiceAccount extends Resource implements IGoogleServiceAccount {
  public readonly account: ServiceAccount;
  public readonly email: string;

  constructor(scope: Construct, name: string, config: GoogleServiceAccountConfig) {
    super(scope, name);

    this.account = new ServiceAccount(this, "registry-push", {
      accountId: name,
      displayName: name, // CamelCase this :)
    });

    this.email = this.account.email;

    new ProjectIamMember(this, "sa-role-binding", {
      role: config.role,
      member: `serviceAccount:${this.email}`,
    });
  }
}
