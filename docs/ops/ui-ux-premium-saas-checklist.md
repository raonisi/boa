# UI/UX Premium SaaS Checklist

BOA CRM is an internal insurance branch CRM. Premium SaaS quality means practical, calm, reliable, and efficient, not decorative.

## Premium SaaS Criteria

- Clear screen purpose within 5 seconds.
- Obvious primary action.
- Dense but readable information.
- Consistent spacing, typography, and component behavior.
- No card-inside-card clutter.
- No marketing-style hero pages for work surfaces.
- No decorative visuals that reduce scan speed.

## Practical Insurance Branch Fit

Screens should support:
- customer lookup
- consultation preparation
- contract review
- follow-up execution
- schedule planning
- notification handling
- admin review

Do not hide essential operational context behind excessive clicks.

## Mobile Usability

Check:
- no horizontal scrolling in normal workflows
- usable touch targets
- reachable bottom navigation and quick actions
- dialogs/sheets that fit the viewport
- tables that degrade into usable mobile views
- scannable customer cards
- keyboard/input flows that do not cover required actions

## Dashboard Clarity

The dashboard should answer:
- What needs attention today?
- Which customer or work item is next?
- What is urgent?
- What changed recently?
- What action can the user take now?

## Tables, Filters, Search, Bulk Actions

Required:
- visible filter state
- useful empty state
- loading state
- error state
- clear selected count for bulk actions
- safe confirmation for high-risk actions
- predictable sorting or grouping where applicable

## Empty / Loading / Error / Forbidden States

- Empty: no data yet or no filtered results.
- Loading: work is in progress.
- Error: recovery action or retry path.
- Forbidden: role or permission issue, not a broken screen.

## Accessibility Basics

Check:
- keyboard-reachable controls
- visible focus where relevant
- sufficient color contrast
- labels for inputs
- accessible names or tooltips for icon buttons
- textual error messages, not color-only errors

## Density and Readability

- Use compact layouts for repeated operations.
- Avoid oversized hero-scale text in dashboards, forms, tables, and admin tools.
- Use clear hierarchy for names, statuses, dates, and actions.
- Preserve authorized customer phone/birthdate visibility when required for operations.

## Evidence Required

For UI/UX approval, include:
- desktop screenshot or browser evidence
- mobile screenshot or mobile viewport evidence
- tested route names
- known visual limitations
- customer-data masking/non-masking rationale when relevant
