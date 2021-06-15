import { Construct } from "constructs";
import { Resource } from "cdktf";
import { GoogleServiceAccount, IGoogleServiceAccount } from './google-service-account';
import { ContainerRegistry, DataGoogleServiceAccount, ServiceAccountKey } from "@cdktf/provider-google";

export interface IGoogleContainerRegistry {
  serviceAccount: IGoogleServiceAccount;
  addKey(): ServiceAccountKey;
}

export interface GoogleContainerRegistryConfig {
  serviceAccount: IGoogleServiceAccount;
}

abstract class GoogleContainerRegistryBase extends Resource implements IGoogleContainerRegistry {
  public abstract readonly serviceAccount: IGoogleServiceAccount;

  addKey() {
    return new ServiceAccountKey(this, 'service-account-key', {
      serviceAccountId: this.serviceAccount.email
    });
  }
}

export class GoogleContainerRegistry extends GoogleContainerRegistryBase {
  public static readonly serviceAccountName: string = 'registry-push';
  public readonly serviceAccount: IGoogleServiceAccount;

  static from(scope: Construct): IGoogleContainerRegistry {
    class Import extends GoogleContainerRegistryBase {
      public readonly serviceAccount: IGoogleServiceAccount;

      constructor(scope: Construct, name: string) {
        super(scope, name);

        this.serviceAccount = new DataGoogleServiceAccount(scope, 'service-account', {
          accountId: GoogleContainerRegistry.serviceAccountName,
        });
      }
    }

    return new Import(scope, 'imported-registry')
  }

  constructor(scope: Construct, name: string) {
    super(scope, name);

    this.serviceAccount = new GoogleServiceAccount(this, GoogleContainerRegistry.serviceAccountName, {
      role: 'roles/storage.admin'
    });

    new ContainerRegistry(this, "registry", {});
  }
}


