# Miles / SLMD SaaS

Miles is a cloud-native, multi-tenant Spatial Operations SaaS.

## Directory Structure

- `slmd/core`: Main Backend API (Express + MongoDB)
  - `address-engine`: Address management
  - `polyline-engine`: Route and Road management
  - `api`: Gateway and Auth
- `slmd/plugins`: Extensible plugin layer (Maps, Data)
- `slmd/admin-ui`: Frontend Admin Console

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run Core Service:
   ```bash
   npm run dev:core
   ```

## Architecture
See `docs/` or the System Prompt for full architectural details.
## Latest Features
- **Address Quality Score (AQS)**: configured in `address-engine` to score addresses (0-100) based on structural, spatial, navigation, visual, and verification factors.
- **Street View Capture**: Backend support for storing `gate_image` metadata sourced from Google Street View.
- **Gate Entry Decision (GED)**: Rules engine for automated gate access logic.
