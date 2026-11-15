# Project workflow

- Use JavaScript and React for the application.
- Review PROJECT_PLAN.md for the proposed structure.
- Work on a separate feature branch for each feature, with a corresponding pull request.
- Use feature/<name>, fix/<name>, or docs/<name> branches; never commit directly to main.
- continuously check main for updates and pull from main as you are working and creating changes on the feature branch
- after changes have passed all tests and are proved to not break the app they can be merged into main through a pull request
- If merge conflicts arise then stop workflow and handle them right away then continue with the current implimentation
- Keep PRs focused and include relevant verification results and screenshots for visible UI changes.
- Do not include unrelated local changes in commits.
- Accuretly add files to git.ignore if needed
- Chekout main before creating a new feature branch and create a pull request with a meaningful description and SS of changes to the app if applicable

## Shared button styles

- Use `src/components/Button.jsx` with a semantic variant for every current and future button. Follow `BUTTON_STYLES.md`.
- Define button appearance in `src/styles/buttons.css`; page styles control only layout. Do not override action colors by page, position, or inline styles.
- Use `join`, `leave`, and `message` variants consistently across cards, activity details, and any future entry points.

## Production publishing

- The GitHub `main` branch is the source of truth for the live ToGo Site.
- A change requested for the live app is complete only after publishing the latest committed `origin/main` with the Sites workflow and verifying deployment success. A GitHub push alone does not publish this Site.
- Preserve Site identity `appgprj_6af8a7f588e481919a944d61b813243f` and its audience. Follow DEPLOYMENT.md.
