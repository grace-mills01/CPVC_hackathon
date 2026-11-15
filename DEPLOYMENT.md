# ToGo production

Source of truth: `grace-mills01/CPVC_hackathon`, branch `main`.
Live URL: https://togo-social-calpoly.cometherring2.chatgpt.site
Sites project: `appgprj_6af8a7f588e481919a944d61b813243f`.

GitHub CI currently checks tests and builds only. It does not deploy. Sites uses a separate source repository and requires an authenticated save-version/deploy operation. The available Sites connector does not offer a persistent GitHub push-triggered deployment connection. Never claim that pushing main automatically publishes the Site.

For every live-app change:

1. Fetch `origin/main` and use its committed source, excluding unrelated working-tree changes.
2. Open this existing Site with the Sites skill source helper and fresh source credentials. Preserve `.openai/hosting.json`, ignored local environment configuration, and audience.
3. Synchronize the application source from the selected main commit into the Site checkout. Record the GitHub commit in `.openai/github-source.json` so the publication can be traced to main. Do not copy Git metadata, credentials, or node_modules.
4. Run tests and the production build. Use the Sites source helper to push the exact source state and package its build.
5. Save that archive-backed version, deploy it, and wait for a successful deployment result.
6. Report the deployed URL and any verification limits. A push or saved version alone is incomplete.

Fully automatic deployment of changes made outside Codex still needs a supported persistent hosting integration. Short-lived Site credentials must not be stored in GitHub Actions or committed.
