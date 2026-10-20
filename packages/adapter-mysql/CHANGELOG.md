# @editable-ui/adapter-mysql

## 0.0.6

### Patch Changes

- ccd9c61: Harden content writes, uploads, rich text, and SQL identifiers. Core and Next integrations now use server-loaded initial content and require consumers to move adapter access out of the client. The SQLite adapter updates its native dependency and now supports Node.js 20 and newer supported majors.
- Updated dependencies [ccd9c61]
  - @editable-ui/core@0.1.0
