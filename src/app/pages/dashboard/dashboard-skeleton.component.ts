import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-skeleton',
  standalone: true,
  template: `
    <div class="dash-skeleton" aria-hidden="true">
      <div class="ds-stats">
        @for (i of [1,2,3,4]; track i) {
          <div class="ds-card">
            <div class="ds-card-icon"></div>
            <div class="ds-card-text">
              <div class="ds-line short"></div>
              <div class="ds-line long"></div>
            </div>
          </div>
        }
      </div>
      <div class="ds-row2">
        <div class="ds-chart wide">
          <div class="ds-title"></div>
          <div class="ds-bars"></div>
        </div>
        <div class="ds-chart narrow">
          <div class="ds-title"></div>
          <div class="ds-donut"></div>
          <div class="ds-legend">
            @for (j of [1,2,3]; track j) {
              <div class="ds-legend-item">
                <div class="ds-dot"></div>
                <div class="ds-line short"></div>
              </div>
            }
          </div>
        </div>
      </div>
      <div class="ds-table">
        <div class="ds-title"></div>
        <div class="ds-table-head"></div>
        @for (r of [1,2,3,4,5]; track r) {
          <div class="ds-table-row"></div>
        }
      </div>
    </div>
  `,
  styles: [`
    .dash-skeleton { padding: 24px; max-width: 1300px; }
    .ds-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }
    .ds-card {
      background: #1e2230;
      border: 1px solid #2e3450;
      border-radius: 14px;
      padding: 16px 20px;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .ds-card-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(90deg, #2e3450 25%, #3d4363 50%, #2e3450 75%);
      background-size: 200% 100%;
      animation: ds-shine 1s ease-in-out infinite;
    }
    .ds-card-text { flex: 1; }
    .ds-line {
      height: 10px;
      border-radius: 4px;
      background: linear-gradient(90deg, #2e3450 25%, #3d4363 50%, #2e3450 75%);
      background-size: 200% 100%;
      animation: ds-shine 1s ease-in-out infinite;
      margin-bottom: 6px;
    }
    .ds-line.short { width: 60%; }
    .ds-line.long { width: 90%; height: 14px; margin-bottom: 0; }
    .ds-row2 {
      display: grid;
      grid-template-columns: 1fr 340px;
      gap: 14px;
      margin-bottom: 14px;
    }
    @media (max-width: 900px) { .ds-row2 { grid-template-columns: 1fr; } }
    .ds-chart {
      background: #1e2230;
      border: 1px solid #2e3450;
      border-radius: 14px;
      padding: 18px;
    }
    .ds-chart .ds-title {
      height: 14px;
      width: 50%;
      border-radius: 4px;
      background: linear-gradient(90deg, #2e3450 25%, #3d4363 50%, #2e3450 75%);
      background-size: 200% 100%;
      animation: ds-shine 1s ease-in-out infinite;
      margin-bottom: 14px;
    }
    .ds-bars {
      height: 200px;
      border-radius: 8px;
      background: linear-gradient(90deg, #2e3450 25%, #3d4363 50%, #2e3450 75%);
      background-size: 200% 100%;
      animation: ds-shine 1s ease-in-out infinite;
    }
    .ds-donut {
      width: 180px;
      height: 180px;
      border-radius: 50%;
      margin: 0 auto 14px;
      background: linear-gradient(90deg, #2e3450 25%, #3d4363 50%, #2e3450 75%);
      background-size: 200% 100%;
      animation: ds-shine 1s ease-in-out infinite;
    }
    .ds-legend { display: flex; flex-direction: column; gap: 8px; }
    .ds-legend-item { display: flex; align-items: center; gap: 8px; }
    .ds-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #2e3450;
      flex-shrink: 0;
    }
    .ds-table {
      background: #1e2230;
      border: 1px solid #2e3450;
      border-radius: 14px;
      padding: 18px;
    }
    .ds-table .ds-title {
      height: 14px;
      width: 40%;
      border-radius: 4px;
      background: linear-gradient(90deg, #2e3450 25%, #3d4363 50%, #2e3450 75%);
      background-size: 200% 100%;
      animation: ds-shine 1s ease-in-out infinite;
      margin-bottom: 14px;
    }
    .ds-table-head {
      height: 36px;
      border-radius: 4px;
      background: #2e3450;
      margin-bottom: 8px;
    }
    .ds-table-row {
      height: 40px;
      border-radius: 4px;
      background: linear-gradient(90deg, #2e3450 25%, #3d4363 50%, #2e3450 75%);
      background-size: 200% 100%;
      animation: ds-shine 1s ease-in-out infinite;
      margin-bottom: 6px;
    }
    .ds-table-row:last-child { margin-bottom: 0; }
    @keyframes ds-shine {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
  `]
})
export class DashboardSkeletonComponent {}
