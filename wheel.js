(function () {
  const VIEW_BOX_SIZE = 100;
  const CENTER = VIEW_BOX_SIZE / 2;
  const RADIUS = 46;
  const INNER_LABEL_BOUND = 16.5;
  const OUTER_LABEL_BOUND = 42.5;

  function escapeMarkup(value) {
    return String(value)
      .split("&")
      .join("&amp;")
      .split("<")
      .join("&lt;")
      .split(">")
      .join("&gt;")
      .split('"')
      .join("&quot;");
  }

  function polarToCartesian(radius, angleDegrees) {
    const radians = (angleDegrees - 90) * (Math.PI / 180);
    return {
      x: CENTER + radius * Math.cos(radians),
      y: CENTER + radius * Math.sin(radians)
    };
  }

  function describeSector(startAngle, endAngle) {
    const startPoint = polarToCartesian(RADIUS, endAngle);
    const endPoint = polarToCartesian(RADIUS, startAngle);
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;

    return [
      `M ${CENTER} ${CENTER}`,
      `L ${endPoint.x.toFixed(3)} ${endPoint.y.toFixed(3)}`,
      `A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${startPoint.x.toFixed(3)} ${startPoint.y.toFixed(3)}`,
      "Z"
    ].join(" ");
  }

  function normalizeDegrees(angle) {
    return ((angle % 360) + 360) % 360;
  }

  function getBaseFontSize(totalCount) {
    if (totalCount <= 4) {
      return 4.8;
    }

    if (totalCount <= 6) {
      return 4.2;
    }

    if (totalCount <= 8) {
      return 3.7;
    }

    if (totalCount <= 12) {
      return 3.1;
    }

    if (totalCount <= 24) {
      return 2.35;
    }

    if (totalCount <= 48) {
      return 1.65;
    }

    if (totalCount <= 72) {
      return 1.25;
    }

    if (totalCount <= 120) {
      return 0.98;
    }

    return 0.86;
  }

  function estimateTextLength(text, fontSize) {
    return Array.from(text).length * fontSize * 0.78;
  }

  function getLabelRotation(midAngle) {
    let rotation = midAngle - 90;
    const normalized = normalizeDegrees(rotation);

    if (normalized > 90 && normalized < 270) {
      rotation += 180;
    }

    return rotation;
  }

  function getLabelLayout(segment, totalCount) {
    const text = (segment.item.label || "-").trim() || "-";
    const midRadius = (INNER_LABEL_BOUND + OUTER_LABEL_BOUND) / 2;
    const tangentialWidth = Math.max(
      2.2,
      2 * midRadius * Math.sin((Math.max(segment.sweepAngle, 1.05) * Math.PI) / 360) - 0.55
    );
    const availableRadial = OUTER_LABEL_BOUND - INNER_LABEL_BOUND - 1.4;

    let fontSize = Math.min(getBaseFontSize(totalCount), tangentialWidth * 0.92);
    fontSize = Math.max(totalCount > 72 ? 0.78 : totalCount > 36 ? 0.95 : 1.15, fontSize);

    const textLength = estimateTextLength(text, fontSize);
    if (textLength > availableRadial) {
      const shrinkRatio = availableRadial / textLength;
      fontSize = Math.max(totalCount > 72 ? 0.68 : 0.82, fontSize * shrinkRatio);
    }

    return {
      text,
      fontSize,
      radius: midRadius,
      strokeWidth: Math.max(0.06, fontSize * 0.035),
      rotation: getLabelRotation(segment.midAngle)
    };
  }

  function buildLabelMarkup(segment, totalCount) {
    const layout = getLabelLayout(segment, totalCount);
    const point = polarToCartesian(layout.radius, segment.midAngle);

    return `
      <g transform="translate(${point.x.toFixed(3)} ${point.y.toFixed(3)}) rotate(${layout.rotation.toFixed(3)})">
        <text
          x="0"
          y="0"
          text-anchor="middle"
          dominant-baseline="middle"
          font-size="${layout.fontSize.toFixed(2)}"
          font-weight="400"
          fill="#354154"
          stroke="rgba(255,255,255,0.34)"
          stroke-width="${layout.strokeWidth.toFixed(2)}"
          paint-order="stroke fill"
          letter-spacing="0"
        >${escapeMarkup(layout.text)}</text>
      </g>
    `;
  }

  function createSegments(items) {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    let cursor = 0;

    return items.map((item) => {
      const sweepAngle = (item.weight / totalWeight) * 360;
      const startAngle = cursor;
      const endAngle = cursor + sweepAngle;
      const midAngle = startAngle + sweepAngle / 2;
      cursor = endAngle;

      return {
        item,
        startAngle,
        endAngle,
        midAngle,
        sweepAngle
      };
    });
  }

  function buildWheel(items) {
    if (!items.length) {
      return {
        segments: [],
        markup: `
          <defs>
            <radialGradient id="emptyWheelGradient" cx="50%" cy="40%" r="70%">
              <stop offset="0%" stop-color="rgba(255,255,255,0.98)"></stop>
              <stop offset="100%" stop-color="rgba(231,236,246,0.96)"></stop>
            </radialGradient>
          </defs>
          <circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" fill="url(#emptyWheelGradient)" stroke="rgba(94,108,132,0.15)" stroke-width="1.2"></circle>
          <circle cx="${CENTER}" cy="${CENTER}" r="14" fill="rgba(255,255,255,0.82)" stroke="rgba(94,108,132,0.12)" stroke-width="0.8"></circle>
          <text x="${CENTER}" y="${CENTER - 2}" text-anchor="middle" font-size="6" font-weight="700" fill="#516076">待设置</text>
          <text x="${CENTER}" y="${CENTER + 6}" text-anchor="middle" font-size="3.6" fill="#7b879c">去设置页添加或启用项目</text>
        `
      };
    }

    const segments = createSegments(items);
    const labelMarkup = segments.map((segment) => buildLabelMarkup(segment, items.length)).join("");

    return {
      segments,
      markup: `
        <defs>
          <radialGradient id="wheelOuterGlow" cx="50%" cy="34%" r="66%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.75)"></stop>
            <stop offset="100%" stop-color="rgba(255,255,255,0)"></stop>
          </radialGradient>
          <radialGradient id="wheelHubFill" cx="50%" cy="38%" r="76%">
            <stop offset="0%" stop-color="rgba(255,255,255,0.98)"></stop>
            <stop offset="100%" stop-color="rgba(239,243,249,0.96)"></stop>
          </radialGradient>
          <filter id="wheelHubShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1.6" stdDeviation="1.6" flood-color="rgba(31,41,55,0.16)"></feDropShadow>
          </filter>
        </defs>
        <circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" fill="rgba(255,255,255,0.42)"></circle>
        ${segments
          .map((segment) => {
            const gapAngle = Math.min(1.2, Math.max(0.3, segment.sweepAngle * 0.08));
            const visualStart = segment.endAngle - segment.startAngle > gapAngle ? segment.startAngle + gapAngle / 2 : segment.startAngle;
            const visualEnd = segment.endAngle - segment.startAngle > gapAngle ? segment.endAngle - gapAngle / 2 : segment.endAngle;
            const path = describeSector(visualStart, visualEnd);
            return `
              <path
                d="${path}"
                fill="${segment.item.color}"
                fill-opacity="0.97"
              ></path>
            `;
          })
          .join("")}
        <circle cx="${CENTER}" cy="${CENTER}" r="${RADIUS}" fill="url(#wheelOuterGlow)"></circle>
        ${labelMarkup}
        <circle cx="${CENTER}" cy="${CENTER}" r="14.8" fill="rgba(255,255,255,0.66)" stroke="rgba(255,255,255,0.48)" stroke-width="0.6"></circle>
        <circle cx="${CENTER}" cy="${CENTER}" r="13.5" fill="url(#wheelHubFill)" stroke="rgba(140,152,171,0.16)" stroke-width="0.7" filter="url(#wheelHubShadow)"></circle>
        <circle cx="${CENTER}" cy="${CENTER}" r="9.4" fill="rgba(247,249,252,0.92)" stroke="rgba(140,152,171,0.12)" stroke-width="0.45"></circle>
        <g transform="translate(${CENTER} ${CENTER})">
          <circle cx="0" cy="-4.8" r="2.85" fill="rgba(255,208,186,0.95)"></circle>
          <circle cx="4.8" cy="0" r="2.85" fill="rgba(188,214,255,0.95)"></circle>
          <circle cx="0" cy="4.8" r="2.85" fill="rgba(197,230,210,0.95)"></circle>
          <circle cx="-4.8" cy="0" r="2.85" fill="rgba(232,208,242,0.95)"></circle>
          <circle cx="0" cy="0" r="3.15" fill="rgba(255,255,255,0.96)" stroke="rgba(140,152,171,0.16)" stroke-width="0.4"></circle>
          <circle cx="0" cy="0" r="1.2" fill="rgba(118,142,176,0.18)"></circle>
        </g>
      `
    };
  }

  function pickSegment(segments) {
    const totalWeight = segments.reduce((sum, segment) => sum + segment.item.weight, 0);
    const threshold = Math.random() * totalWeight;
    let cursor = 0;

    for (const segment of segments) {
      cursor += segment.item.weight;
      if (threshold <= cursor) {
        return segment;
      }
    }

    return segments.length ? segments[segments.length - 1] : null;
  }

  function calculateSpinRotation(currentRotation, segment) {
    if (!segment) {
      return currentRotation;
    }

    const segmentPadding = Math.min(segment.sweepAngle * 0.22, 7);
    const safeStart = segment.startAngle + segmentPadding;
    const safeEnd = segment.endAngle - segmentPadding;
    const targetAngle =
      safeEnd - safeStart > 1
        ? safeStart + Math.random() * (safeEnd - safeStart)
        : segment.midAngle;
    const finalAngle = normalizeDegrees(360 - targetAngle);
    const currentNormalized = normalizeDegrees(currentRotation);
    const extraSpins = 7 + Math.floor(Math.random() * 3);
    const delta = extraSpins * 360 + normalizeDegrees(finalAngle - currentNormalized);

    return currentRotation + delta;
  }

  window.WeekendWheelEngine = {
    buildWheel,
    pickSegment,
    calculateSpinRotation
  };
})();
