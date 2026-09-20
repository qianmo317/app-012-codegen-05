import type { HerbMeta } from '../types';

export interface DrawerRect {
  x: number;
  y: number;
  w: number;
  h: number;
  herb: string;
  open: number;
  hovered: boolean;
}

export class CabinetRenderer {
  drawers: DrawerRect[] = [];
  private cols = 6;
  private rows = 6;
  private padding = 10;
  private drawerW = 80;
  private drawerH = 50;
  private stock = new Map<string, number>();
  /** 方子里实际要抓的药名（含替代药），缺货/非本方的置灰 */
  needed = new Set<string>();

  layout(canvasW: number, _canvasH: number): void {
    this.drawers = [];
    const startX = canvasW - this.cols * (this.drawerW + this.padding) - this.padding;
    const startY = this.padding + 60;
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.drawers.push({
          x: startX + c * (this.drawerW + this.padding),
          y: startY + r * (this.drawerH + this.padding),
          w: this.drawerW,
          h: this.drawerH,
          herb: '',
          open: 0,
          hovered: false,
        });
      }
    }
  }

  setHerbs(herbs: HerbMeta[], stock?: Map<string, number>, needed?: Set<string>): void {
    for (let i = 0; i < this.drawers.length && i < herbs.length; i++) {
      this.drawers[i].herb = herbs[i].name;
    }
    for (let i = herbs.length; i < this.drawers.length; i++) {
      this.drawers[i].herb = '';
    }
    if (stock) this.stock = stock;
    if (needed) this.needed = needed;
  }

  updateHover(mx: number, my: number): void {
    for (const d of this.drawers) {
      d.hovered = mx >= d.x && mx <= d.x + d.w && my >= d.y && my <= d.y + d.h;
    }
  }

  getDrawerAt(mx: number, my: number): DrawerRect | null {
    return this.drawers.find(d => mx >= d.x && mx <= d.x + d.w && my >= d.y && my <= d.y + d.h) || null;
  }

  openDrawer(herb: string): void {
    const d = this.drawers.find(x => x.herb === herb);
    if (d) d.open = 1;
  }

  closeDrawer(herb: string): void {
    const d = this.drawers.find(x => x.herb === herb);
    if (d) d.open = 0;
  }

  /** 抓药扣库存后刷新抽屉上的存量显示 */
  updateStock(stock: Map<string, number>): void {
    this.stock = stock;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const d of this.drawers) {
      this.drawDrawer(ctx, d);
    }
  }

  private drawDrawer(ctx: CanvasRenderingContext2D, d: DrawerRect): void {
    const depth = d.open * 8;
    const isNeeded = d.herb && this.needed.has(d.herb);
    const bg = d.hovered ? '#8b6914' : isNeeded ? '#7a5a30' : '#5a4028';

    ctx.fillStyle = '#4a3728';
    ctx.fillRect(d.x, d.y, d.w, d.h);

    ctx.fillStyle = bg;
    ctx.fillRect(d.x + depth, d.y + depth, d.w - depth * 2, d.h - depth * 2);

    ctx.strokeStyle = '#3e2b1f';
    ctx.lineWidth = 2;
    ctx.strokeRect(d.x + depth, d.y + depth, d.w - depth * 2, d.h - depth * 2);

    if (d.herb) {
      ctx.fillStyle = isNeeded ? '#ffe9c4' : '#c9b89a';
      ctx.font = '14px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(d.herb, d.x + d.w / 2 + depth, d.y + d.h / 2 - 5 + depth);

      if (this.stock.has(d.herb)) {
        const grams = this.stock.get(d.herb) ?? 0;
        ctx.fillStyle = grams <= 0 ? '#ff6b6b' : grams < 15 ? '#e8a33d' : '#a8c98f';
        ctx.font = '10px sans-serif';
        ctx.fillText(`${grams}g`, d.x + d.w / 2 + depth, d.y + d.h - 9 + depth);
      }
    }

    if (d.open > 0.5) {
      ctx.fillStyle = 'rgba(139, 69, 19, 0.3)';
      ctx.fillRect(d.x + depth + 4, d.y + depth + 4, d.w - depth * 2 - 8, d.h - depth * 2 - 8);
    }
  }
}
