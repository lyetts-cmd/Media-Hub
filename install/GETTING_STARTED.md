# Getting Started with Cadence Music

This guide helps you choose the right installation path and configure Cadence for your hardware.

---

## Which install method is right for me?

| Situation | Recommended path |
|-----------|-----------------|
| You have Docker installed (or are happy to install it) | [Docker install](INSTALL_DOCKER.md) |
| You prefer not to use Docker or want full systemd control | [Bare-metal install](INSTALL.md) |
| You are on a Raspberry Pi and want the simplest setup | [Docker install](INSTALL_DOCKER.md) |
| You want to develop or modify Cadence's source code | [Bare-metal install](INSTALL.md) |

**When in doubt, use Docker.** It handles Node.js, PostgreSQL, and FFmpeg automatically, and the pre-built multi-arch image works on both x86 (amd64) and ARM (arm64) without any compilation on your device.

---

## Device tier reference

Use this table to choose the right performance environment variables for your hardware. See `config.example.env` for full descriptions of each setting.

| Device | `TRANSCODE_WORKERS` | `FFMPEG_THREADS` | `FFMPEG_HWACCEL` |
|--------|--------------------:|------------------:|------------------|
| Raspberry Pi 4 | `1` | `2` | *(leave unset)* |
| Low-spec x86 (old laptop, Atom/Celeron) | `2` | `4` | *(leave unset)* |
| Mid/high-spec x86 (spare desktop, i5/Ryzen) | `4` | `0` | `vaapi` *(if Intel/AMD iGPU)* |

**VAAPI hardware acceleration** (Intel and AMD integrated graphics on Linux x86) can significantly reduce CPU load during transcoding. To enable it, set `FFMPEG_HWACCEL=vaapi` in your `.env`. Docker users should also uncomment the `/dev/dri` device passthrough block in `docker-compose.yml` — the relevant lines are clearly marked inside that file.

---

## Quick links

- [Docker Installation Guide](INSTALL_DOCKER.md)
- [Bare-metal / systemd Installation Guide](INSTALL.md)
- [Environment variable reference](config.example.env)
