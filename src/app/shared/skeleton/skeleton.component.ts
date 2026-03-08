import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  standalone: true,
  template: `
    <div class="skeleton" aria-hidden="true">
      @for (row of _rowsArray; track row) {
        <div class="skeleton-row">
          @for (cell of _cellsArray; track cell) {
            <div class="skeleton-cell"></div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .skeleton { padding: 1rem; }
    .skeleton-row { display: flex; gap: 0.5rem; margin-bottom: 0.5rem; }
    .skeleton-cell {
      height: 1.25rem;
      background: linear-gradient(90deg, #2e3450 25%, #3d4363 50%, #2e3450 75%);
      background-size: 200% 100%;
      animation: skeleton 1s ease-in-out infinite;
      border-radius: 4px;
    }
    .skeleton-cell:nth-child(1) { flex: 2; }
    .skeleton-cell:nth-child(2), .skeleton-cell:nth-child(3) { flex: 1; }
    @keyframes skeleton {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `],
})
export class SkeletonComponent {
  @Input() set rows(v: number) {
    const n = (v != null && typeof v === 'number' && v >= 0) ? v : 8;
    this._rows = n;
    this._rowsArray = Array(n).fill(0).map((_, i) => i);
  }
  @Input() set cells(v: number) {
    const n = (v != null && typeof v === 'number' && v >= 0) ? v : 4;
    this._cells = n;
    this._cellsArray = Array(n).fill(0).map((_, i) => i);
  }
  private _rows = 8;
  private _cells = 4;
  _rowsArray: number[] = Array(8).fill(0).map((_, i) => i);
  _cellsArray: number[] = Array(4).fill(0).map((_, i) => i);
}
