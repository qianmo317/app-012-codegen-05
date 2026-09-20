import type { Prescription, WeighResult, SubstitutionComparison, SubstitutionDecision } from '../types';

export class UIRenderer {
  prescriptionX: number = 20;
  prescriptionY: number = 60;
  prescriptionW: number = 260;
  buttonRects: Array<{ x: number; y: number; w: number; h: number; action: string }> = [];

  layout(canvasW: number, _canvasH: number): void {
    this.prescriptionX = 20;
    this.prescriptionY = 60;
    this.prescriptionW = Math.min(260, canvasW * 0.3);
  }

  drawPrescription(
    ctx: CanvasRenderingContext2D,
    prescription: Prescription,
    weighed: Set<string>,
    currentHerb: string | null,
    opts?: {
      stock?: Map<string, number>;
      substituteCandidate?: Map<string, string>;
      substituteGrams?: Map<string, number>;
      shortageOriginal?: string | null;
      recalled?: Map<string, SubstitutionDecision>;
    },
  ): void {
    const x = this.prescriptionX;
    const y = this.prescriptionY;
    const w = this.prescriptionW;
    const lineH = 32;
    const headerH = 44;

    ctx.fillStyle = 'rgba(255, 252, 245, 0.95)';
    ctx.fillRect(x, y, w, prescription.items.length * lineH + headerH + 22);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, prescription.items.length * lineH + headerH + 22);

    ctx.fillStyle = '#8b4513';
    ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`处方  病人:${prescription.patientId}`, x + 10, y + 16);

    prescription.items.forEach((item, i) => {
      const iy = y + headerH + 12 + i * lineH;
      const candidate = opts?.substituteCandidate?.get(item.herb);
      const adjGrams = opts?.substituteGrams?.get(item.herb);
      const recalledNow = opts?.recalled?.get(item.herb);
      const isWeighed = weighed.has(item.herb);
      const isShort = opts?.shortageOriginal === item.herb;
      const isCurrent = currentHerb === item.herb || (candidate !== undefined && currentHerb === candidate);
      const recalled: SubstitutionDecision | undefined = (recalledNow && (candidate === recalledNow.candidate || isShort)) ? recalledNow : undefined;

      if (isCurrent) {
        ctx.fillStyle = 'rgba(212, 165, 116, 0.3)';
        ctx.fillRect(x + 4, iy - 14, w - 8, lineH - 4);
      }
      if (isShort) {
        ctx.fillStyle = 'rgba(220, 20, 60, 0.15)';
        ctx.fillRect(x + 4, iy - 14, w - 8, lineH - 4);
      }

      ctx.fillStyle = isWeighed ? '#999' : '#333';
      ctx.font = `${isWeighed ? '' : 'bold '}14px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'left';
      const confirmedCandidate: string | undefined = candidate !== undefined && adjGrams !== undefined ? candidate : undefined;
      if (confirmedCandidate) {
        ctx.fillText(`${item.herb} ${item.grams}g → ${confirmedCandidate} ${adjGrams}g`, x + 12, iy - 4);
        ctx.fillStyle = '#b8860b';
        ctx.font = '11px "Microsoft YaHei", sans-serif';
        ctx.fillText(recalled && !isShort ? `[按上次定的顶替]` : `[药性相近，顶替]`, x + 12, iy + 10);
      } else {
        let text = `${item.herb} ${item.grams}g`;
        if (item.decoct === 'first') text += ' [先煎]';
        if (item.decoct === 'last') text += ' [后下]';
        ctx.fillText(text, x + 12, iy - (isShort && recalled ? 4 : 0));
        if (isShort && recalled) {
          ctx.fillStyle = '#b8860b';
          ctx.font = '11px "Microsoft YaHei", sans-serif';
          ctx.fillText(`缺货·上次定用${recalled.candidate}顶`, x + 12, iy + 12);
        }
      }

      const stockText = opts?.stock !== undefined ? `柜存${opts.stock.get(item.herb) ?? 0}g` : '';
      if (stockText) {
        ctx.fillStyle = (opts?.stock?.get(item.herb) ?? 0) < item.grams ? '#dc143c' : '#888';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(stockText, x + w - 10, iy);
        ctx.textAlign = 'left';
      }

      if (isWeighed) {
        ctx.beginPath();
        ctx.moveTo(x + 12, iy - 12);
        ctx.lineTo(x + w - 12, iy - 12);
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }

  drawStatus(ctx: CanvasRenderingContext2D, level: number, score: number, combo: number, queue: number, satisfaction: number, timeLeft: number | null): void {
    const x = 20;
    const y = 10;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, 600, 48);

    ctx.fillStyle = '#f5e6d3';
    ctx.font = '14px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let text = `第${level}关  分数:${score}  连击:${combo}  排队:${queue}  满意度:${satisfaction}`;
    if (timeLeft !== null) {
      const color = timeLeft < 10 ? '#ff4444' : '#f5e6d3';
      ctx.fillStyle = color;
      text += `  时间:${Math.ceil(timeLeft)}s`;
    }
    ctx.fillText(text, x, y + 24);
  }

  drawPackageArea(ctx: CanvasRenderingContext2D, _canvasW: number, canvasH: number, packages: Array<{ herb: string; grams: number; decoct: string; replaces?: string }>): void {
    const x = 20;
    const y = canvasH - 120;
    const w = 400;
    const h = 100;

    ctx.fillStyle = 'rgba(245, 230, 211, 0.9)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#8b4513';
    ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('已分包', x + 10, y + 20);

    packages.forEach((pkg, i) => {
      const px = x + 10 + (i % 4) * 95;
      const py = y + 36 + Math.floor(i / 4) * 28;
      ctx.fillStyle = '#fff8f0';
      ctx.fillRect(px, py, 88, 24);
      ctx.strokeStyle = '#d4a574';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, 88, 24);
      ctx.fillStyle = '#333';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let label = `${pkg.herb}`;
      if (pkg.decoct !== 'normal') label += '*';
      if (pkg.replaces) label += '代';
      ctx.fillText(label, px + 44, py + 12);
    });
  }

  drawButtons(_ctx: CanvasRenderingContext2D): void {
    this.buttonRects = [];
  }

  drawMenu(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, highestScore: number, highestLevel: number): void {
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const cx = canvasW / 2;
    const cy = canvasH / 2;

    ctx.fillStyle = '#d4a574';
    ctx.font = 'bold 36px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('中药柜抓药', cx, cy - 120);
    ctx.font = '20px "Microsoft YaHei", sans-serif';
    ctx.fillText('戥子称重模拟', cx, cy - 80);

    const buttons = [
      { label: '开始游戏', action: 'start' },
      { label: '无尽模式', action: 'endless' },
    ];

    this.buttonRects = [];
    buttons.forEach((btn, i) => {
      const bx = cx - 80;
      const by = cy - 20 + i * 60;
      const bw = 160;
      const bh = 44;

      ctx.fillStyle = '#6b4e23';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#d4a574';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = '#f5e6d3';
      ctx.font = '18px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, cx, by + bh / 2);

      this.buttonRects.push({ x: bx, y: by, w: bw, h: bh, action: btn.action });
    });

    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.fillText(`最高分: ${highestScore}  最高关卡: ${highestLevel}`, cx, cy + 120);
  }

  /** 缺货替药比对面板：候选按药性/存量/单价/用量增减摆在一起比 */
  drawShortagePanel(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, comparison: SubstitutionComparison, selected: string | null, recalled: SubstitutionDecision | null): void {
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const w = Math.min(720, canvasW - 40);
    const headerH = 78;
    const rowH = 56;
    const footerH = 56;
    const h = headerH + comparison.candidates.length * rowH + footerH + 16;
    const left = cx - w / 2;
    const top = cy - h / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#fff8f0';
    ctx.fillRect(left, top, w, h);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 3;
    ctx.strokeRect(left, top, w, h);

    ctx.fillStyle = '#8b4513';
    ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${comparison.original} 柜中仅剩 ${comparison.stockGrams}g，本方需 ${comparison.requiredGrams}g，请从药性相近的药里选一味顶上：`, left + 16, top + 22);

    // 表头
    const colName = left + 16;
    const colSim = left + 120;
    const colStock = left + 230;
    const colDose = left + 340;
    const colPrice = left + 450;
    const colScore = left + 540;
    ctx.fillStyle = '#8b6914';
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.fillText('候选药', colName, top + 52);
    ctx.fillText('药性相似', colSim, top + 52);
    ctx.fillText('现有存量', colStock, top + 52);
    ctx.fillText('用量增减', colDose, top + 52);
    ctx.fillText('单价/药费', colPrice, top + 52);
    ctx.fillText('综合', colScore, top + 52);

    this.buttonRects = [];
    comparison.candidates.forEach((c, i) => {
      const ry = top + headerH + i * rowH;
      const isSel = selected === c.candidate && c.sufficient;
      if (isSel) {
        ctx.fillStyle = 'rgba(212, 175, 55, 0.25)';
      } else if (!c.sufficient) {
        ctx.fillStyle = 'rgba(220, 20, 60, 0.08)';
      } else {
        ctx.fillStyle = i % 2 === 0 ? 'rgba(245, 230, 211, 0.5)' : 'rgba(255, 255, 255, 0.4)';
      }
      ctx.fillRect(left + 8, ry + 2, w - 16, rowH - 4);

      const isRecalled = recalled?.candidate === c.candidate;
      if (isSel) {
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 2;
        ctx.strokeRect(left + 8, ry + 2, w - 16, rowH - 4);
      }

      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = c.sufficient ? '#333' : '#999';
      ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
      ctx.fillText(c.candidate, colName, ry + rowH / 2 - (isRecalled || c.drawbacks[0] ? 8 : 0));
      if (isRecalled) {
        ctx.fillStyle = '#b8860b';
        ctx.font = '10px "Microsoft YaHei", sans-serif';
        ctx.fillText(`★上次${recalled.decidedBy}定·默认`, colName, ry + rowH / 2 + 12);
      }

      ctx.font = '13px "Microsoft YaHei", sans-serif';
      ctx.fillStyle = c.similarity >= 60 ? '#228b22' : c.similarity >= 40 ? '#b8860b' : '#dc143c';
      ctx.fillText(`${c.similarity}分`, colSim, ry + 16);

      ctx.fillStyle = c.sufficient ? '#333' : '#dc143c';
      ctx.fillText(`${c.stockGrams}g`, colStock, ry + 16);

      if (c.doseChangePct === 0) {
        ctx.fillStyle = '#228b22';
        ctx.fillText('不减不增', colDose, ry + 16);
      } else {
        ctx.fillStyle = Math.abs(c.doseChangePct) <= 20 ? '#b8860b' : '#dc143c';
        ctx.fillText(`${c.doseChangePct > 0 ? '加' : '减'}${Math.abs(c.doseChangePct)}%→${c.adjustedGrams}g`, colDose, ry + 16);
      }

      ctx.fillStyle = '#333';
      ctx.fillText(`${c.pricePer10g}文/10g`, colPrice, ry + 12);
      ctx.fillStyle = '#666';
      ctx.font = '11px sans-serif';
      ctx.fillText(`共${c.totalPrice}文`, colPrice, ry + 32);

      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = comparison.recommended?.candidate === c.candidate ? '#228b22' : '#333';
      ctx.fillText(c.sufficient ? `${c.score}分` : '—', colScore, ry + 16);
      if (comparison.recommended?.candidate === c.candidate && !isRecalled) {
        ctx.fillStyle = '#228b22';
        ctx.font = '10px "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('推荐', colScore, ry + 38);
      }

      // 差在哪一条
      ctx.fillStyle = '#888';
      ctx.font = '11px "Microsoft YaHei", sans-serif';
      const drawback = c.drawbacks[0] ?? (comparison.recommended?.candidate === c.candidate ? '★ 推荐：综合最合适' : '');
      if (drawback) ctx.fillText(drawback.slice(0, 46), colSim, ry + 40);

      if (c.sufficient) {
        this.buttonRects.push({ x: left + 8, y: ry + 2, w: w - 16, h: rowH - 4, action: `cand-${c.candidate}` });
      }
    });

    // 底部按钮
    const fy = top + headerH + comparison.candidates.length * rowH + 12;
    if (comparison.recommended) {
      this.drawPanelButton(ctx, left + w - 300, fy, 140, 36, `定：${selected ?? ''}`, 'confirm-substitute', !selected);
    }
    ctx.fillStyle = '#666';
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('数字键 1-9 可选候选，回车定药', left + 16, fy + 18);
  }

  /** 候选都撑不下来：明确告诉抓药的人方子今天配不齐 */
  drawUnfillable(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, message: string): void {
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const w = 520;
    const h = 220;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.fillStyle = '#fff8f0';
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    ctx.strokeStyle = '#dc143c';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);

    ctx.fillStyle = '#dc143c';
    ctx.font = 'bold 22px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('这张方子今天配不齐', cx, cy - 60);

    ctx.fillStyle = '#333';
    ctx.font = '14px "Microsoft YaHei", sans-serif';
    this.wrapText(ctx, message, cx, cy - 10, w - 60, 22);

    this.buttonRects = [];
    this.drawPanelButton(ctx, cx - 80, cy + 60, 160, 40, '告知病人，下一位', 'ack-unfillable', false);
  }

  private wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxWidth: number, lineH: number): void {
    let line = '';
    let lineY = y;
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxWidth && line) {
        ctx.fillText(line, cx, lineY);
        line = ch;
        lineY += lineH;
      } else {
        line += ch;
      }
    }
    if (line) ctx.fillText(line, cx, lineY);
  }

  private drawPanelButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, label: string, action: string, disabled: boolean): void {
    ctx.fillStyle = disabled ? '#bbb' : '#6b4e23';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = disabled ? '#999' : '#d4a574';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = disabled ? '#666' : '#f5e6d3';
    ctx.font = '15px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2);
    if (!disabled) this.buttonRects.push({ x, y, w, h, action });
  }

  drawReview(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, herb: string, options: number[], selected: number | null, result: boolean | null): void {
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const w = 360;
    const h = 240;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = '#fff8f0';
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);

    ctx.fillStyle = '#8b4513';
    ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`复核：刚才 ${herb} 抓了多少克？`, cx, cy - 70);

    this.buttonRects = [];
    options.forEach((opt, i) => {
      const bx = cx - 140 + i * 100;
      const by = cy - 20;
      const bw = 80;
      const bh = 44;

      ctx.fillStyle = selected === opt && result === false ? '#ff6b6b' : selected === opt && result === true ? '#90ee90' : '#f5e6d3';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#8b6914';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = '#333';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${opt}g`, bx + bw / 2, by + bh / 2);

      this.buttonRects.push({ x: bx, y: by, w: bw, h: bh, action: `review-${opt}` });
    });

    if (result !== null) {
      ctx.fillStyle = result ? '#228b22' : '#dc143c';
      ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
      ctx.fillText(result ? '回答正确！' : '回答错误！', cx, cy + 50);
    }
  }

  drawResult(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, score: number, level: number, results: WeighResult[], passed: boolean): void {
    const cx = canvasW / 2;
    const cy = canvasH / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = '#fff8f0';
    ctx.fillRect(cx - 200, cy - 180, 400, 360);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 200, cy - 180, 400, 360);

    ctx.fillStyle = passed ? '#228b22' : '#dc143c';
    ctx.font = 'bold 28px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(passed ? '关卡通过！' : '关卡失败', cx, cy - 140);

    ctx.fillStyle = '#333';
    ctx.font = '18px sans-serif';
    ctx.fillText(`第${level}关  得分: ${score}`, cx, cy - 100);

    results.forEach((r, i) => {
      const ry = cy - 60 + i * 28;
      const color = r.ok ? '#228b22' : '#dc143c';
      ctx.fillStyle = color;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'left';
      const name = r.dispensedAs && r.dispensedAs !== r.herb ? `${r.herb}→${r.dispensedAs}` : r.herb;
      ctx.fillText(`${name}: 目标${r.target}g 实际${r.actual.toFixed(1)}g 差${r.deltaG > 0 ? '+' : ''}${r.deltaG.toFixed(1)}g`, cx - 160, ry);
    });

    this.buttonRects = [];
    const btnLabel = passed ? '下一关' : '重试';
    const bx = cx - 60;
    const by = cy + 140;
    const bw = 120;
    const bh = 40;

    ctx.fillStyle = '#6b4e23';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = '#f5e6d3';
    ctx.font = '18px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btnLabel, cx, by + bh / 2);

    this.buttonRects.push({ x: bx, y: by, w: bw, h: bh, action: passed ? 'next' : 'retry' });
  }

  drawGameOver(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, score: number, level: number): void {
    const cx = canvasW / 2;
    const cy = canvasH / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = '#dc143c';
    ctx.font = 'bold 36px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('病人都走光了', cx, cy - 60);

    ctx.fillStyle = '#f5e6d3';
    ctx.font = '20px sans-serif';
    ctx.fillText(`最终得分: ${score}  通过关卡: ${level}`, cx, cy);

    this.buttonRects = [];
    const bx = cx - 60;
    const by = cy + 50;
    const bw = 120;
    const bh = 40;

    ctx.fillStyle = '#6b4e23';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = '#f5e6d3';
    ctx.font = '18px "Microsoft YaHei", sans-serif';
    ctx.fillText('返回菜单', cx, by + bh / 2);

    this.buttonRects.push({ x: bx, y: by, w: bw, h: bh, action: 'menu' });
  }

  drawInstructions(ctx: CanvasRenderingContext2D, _canvasW: number, canvasH: number): void {
    const x = 20;
    const y = canvasH - 80;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, 500, 70);
    ctx.fillStyle = '#ccc';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('操作: 1-9选抽屉 / 拖拽药材到秤盘 / 滚轮微调 / 空格确认 / Z归零', x + 10, y + 10);
    ctx.fillText('目标: 按处方抓药，误差在允许范围内', x + 10, y + 30);
    ctx.fillText('注意: 先煎/后下药要单独分包', x + 10, y + 48);
  }

  drawTareButton(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean): void {
    ctx.fillStyle = active ? '#d4a574' : '#f5e6d3';
    ctx.fillRect(x, y, 60, 32);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 60, 32);
    ctx.fillStyle = '#333';
    ctx.font = '14px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('归零', x + 30, y + 16);
  }
}
