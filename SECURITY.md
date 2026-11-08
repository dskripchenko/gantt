# Security policy

A chart shows data that other people wrote: names of rows, labels of bars and
milestones. The package is built so that none of it becomes active content in
the page.

## What is guaranteed

- **Text is text.** Row names, cell values, bar and milestone labels and ARIA
  names are rendered with Vue interpolation; no field of the model is ever
  inserted as HTML.
- **Parsing is strict.** `parseModel` keeps only known fields, checks dates
  and ids, clamps numbers and drops links to unknown bars.
- **No requests of its own.** The components fetch nothing. Saving goes
  through the `persist` function the host passes, with the host's own
  credentials and URLs.
- **Slots are the host's code.** Content given in the `cell`, `group`,
  `header-cell` and `empty` slots runs with the host's trust; render model
  text with interpolation, not `v-html`.

## What the host is responsible for

- **Permissions.** The chart reports changes; whether a person may make them
  is decided by the host's server when it saves them. Pass `editable`,
  `linkable` and `locked` to match what the person may do, and refuse on the
  server anyway.

## Reporting a vulnerability

Please report security issues privately to the author through GitHub's
"Report a vulnerability" on the repository, not in public issues.
