# thinkific-cli

CLI tool for the [Thinkific API](https://developers.thinkific.com/api/api-documentation/).

## Installation

```bash
npm install -g thinkific-cli
```

## Authentication

```bash
thinkific auth login --token <api-key> --subdomain <your-subdomain>
thinkific auth status
thinkific auth switch --subdomain <other-site>
thinkific auth logout
```

Or use environment variables:

```bash
export THINKIFIC_OAUTH_TOKEN=your-token
export THINKIFIC_SUBDOMAIN=your-subdomain
```

## Usage

All list commands support `--limit`, `--page`, and `--json` flags. Many support `--all` to auto-paginate.

```bash
# Courses
thinkific courses list --all --json
thinkific courses get 123
thinkific courses chapters 123

# Users
thinkific users list --company "Acme"
thinkific users create --first-name Jane --last-name Doe --email jane@example.com
thinkific users search jane@example.com
thinkific users update 456 --company "NewCo"
thinkific users delete 456

# Enrollments
thinkific enrollments list --course-id 123
thinkific enrollments create --course-id 123 --user-id 456
thinkific enrollments bulk --course-id 123 --company "Acme"

# Orders, Products, Bundles, Groups, Promotions, Coupons,
# Categories, Instructors, Reviews, Site, Publish Requests,
# External Orders, Profile Fields
thinkific <command> --help
```

## Features

- Pretty table output by default, `--json` for machine-readable output
- Colored output (green=success, red=error, yellow=warning, cyan=info)
- Spinner during API calls
- Rate limit handling with automatic retry (up to 3 attempts)
- `--all` flag to auto-fetch all pages
- Confirmation prompts for destructive actions (`--force` to skip)
- Multi-site support with `auth switch`

## License

MIT
