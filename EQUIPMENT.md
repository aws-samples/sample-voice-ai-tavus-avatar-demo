# Voice AI Demo - Equipment Guide

Use this as a reference to replicate the demo setup. All items below were used at GTC or are recommended replacements. Links are to Australian retailers where available.

## Equipment List

| Item | Buy (AU) | Cost (AUD) | GTC Replica? | Critical Capabilities (if sourcing locally) |
|---|---|---|---|---|
| Elgato Stream Deck MK.2 | [Amazon AU](https://www.amazon.com.au/Elgato-Stream-Deck-MK-2-Controller/dp/B09738CV2G) | ~$194 | Yes | Programmable macro buttons with custom icons; USB connectivity; 15+ buttons minimum |
| Sennheiser E 945 Microphone | [Amazon US](https://www.amazon.com/dp/B000NAXCC0) | ~$300 | Yes | Dynamic (not condenser) supercardioid pattern; XLR output; strong off-axis rejection for noisy environments |
| Audient iD14 MKII Audio Interface | [Amazon US](https://www.amazon.com/dp/B08SJD466P) | ~$350 | Yes | XLR input with phantom power; USB-C to Mac; clean preamp; low-latency driver support on macOS |
| OnStage Mic Windscreen | [Amazon AU](https://www.amazon.com.au/dp/B001ANI6VQ) | ~$20 | Yes | Foam ball-type; fits standard handheld dynamic mic head |
| Mac Mini M4 | [Apple AU](https://www.apple.com/au/shop/buy-mac/mac-mini) | $999 | Yes | macOS (required for Krisp, Audio Hijack, Loopback); M-series chip for low-latency audio processing; minimum 16GB RAM |
| Bose SoundLink Flex Speaker | [Bose AU](https://www.bose.com.au/en_au/products/speakers/bluetooth_speakers/soundlink-flex.html) | ~$229 | New recommendation | 3.5mm or Bluetooth input; battery-powered; portable; clear mid-range for voice reproduction |

**Total: ~$2,092 AUD**

> If the venue provides A/V, the speaker may not be needed. At GTC, the conference A/V team supplied the speaker — the Mac Mini headphone jack was plugged directly into it.

## Software

The following apps need to be installed and configured on the Mac Mini before the demo:

- **[Krisp](https://krisp.ai)** - AI noise cancellation, applied to mic input
- **[Audio Hijack](https://rogueamoeba.com/audiohijack/)** - Routes and processes audio from the mic
- **[Loopback](https://rogueamoeba.com/loopback/)** - Creates virtual audio devices for routing mic input into the demo app

## Audio Signal Chain

```
Sennheiser E 945 (XLR)
  → Audient iD14 MKII (USB-C)
    → Mac Mini
      → Loopback (virtual audio device)
        → Krisp (noise cancellation)
          → Audio Hijack (routing)
            → Demo app (voice input)
              → Speaker / headphone jack (voice output)
```

## Notes

- The Stream Deck triggers demo scenario buttons on stage - configure macros before the event
- Use a headset as backup if the venue is unexpectedly noisy and the mic setup isn't sufficient
- Pre-test the full audio chain in the venue before the demo goes live
