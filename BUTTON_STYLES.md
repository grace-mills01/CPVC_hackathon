# Button conventions

Use `src/components/Button.jsx` for every button. Choose a semantic `variant` rather than styling an action by its page or position. The component adds `button` and `button--<variant>` classes. Shared colors and interaction states live in `src/styles/buttons.css`.

| Variant | Use |
| --- | --- |
| primary | Sign in, save profile, post activity, send message |
| secondary | Create account, find an activity |
| join | Join activity on every page; green to blue |
| leave | Leave activity on every page; red to black |
| message | Message group / Group chat; green to blue |
| hosting / full | Disabled hosting and capacity states |
| quiet | Back links and sign out |
| icon | Back and profile settings icon controls |
| outline | Fill in an example |
| nav | Main navigation, with active state |
| stepper | Increase / decrease capacity |
| card | Open activity card |
| conversation | Open conversation row |
| plan | Open profile plan or matching-settings row |
| chip | Toggle pill: interests, weekdays, calendar app, filters; set `aria-pressed` |
| calendar | Add to Google/Apple/Outlook Calendar and calendar-feed actions |
| link | Inline text action inside a sentence, e.g. "reset it" |
| notice | Open a notification row; add `unread` for new ones |
| choice | Toggle tile with an icon: onboarding goals; set `aria-pressed` |

Page classes may set layout, width, spacing, and alignment. Never override a button variant’s background or text color with a page selector, `:first-child`, or inline style. New buttons must reuse an existing variant or add a semantic variant here and in buttons.css. Preserve disabled and focus states. Keep join, leave, and message actions stacked in activity action groups.

`send`: circular light blue send control in a group conversation.
