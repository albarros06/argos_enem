# Data Model: Animação de Abertura do Olho na Tela de Login

**Date**: 2026-07-22 | **Plan**: [plan.md](./plan.md)

This feature introduces no data model. It is a purely presentational client component with no
persisted state, no database table, and no server-side entity. The only "state" involved is
transient, in-memory React component state (whether the intro is still mounted, and whether
reduced motion was detected on mount) that exists only for the lifetime of the login page in
the browser and is never read or written anywhere else.
