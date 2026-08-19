import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { config } from "dotenv";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

config({ path: "./.env" });
config({ path: "../../apps/web/.env" });

export default Alchemy.Stack(
  "long-play",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    // _worker.js is a shim importing outside its directory, so it must be bundled
    const webWorker = yield* Cloudflare.Website.StaticSite("web", {
      cwd: "../../apps/web",
      command: "pnpm run build",
      // Rebuild shared workspace dependencies until Alchemy has a workspace-aware default memo.
      memo: false,
      outdir: ".svelte-kit/cloudflare",
      main: "../../apps/web/.svelte-kit/cloudflare/_worker.js",
      compatibility: {
        flags: ["nodejs_compat"],
      },
      env: {
        PUBLIC_SERVER_URL: Config.string("PUBLIC_SERVER_URL"),
      },
      dev: {
        command: "pnpm run dev:bare",
        url: "http://localhost:5173",
      },
    });

    return {
      web: webWorker.url,
    };
  }),
);
