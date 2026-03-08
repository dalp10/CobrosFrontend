import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'formatPercent', standalone: true })
export class FormatPercentPipe implements PipeTransform {
  transform(paid: number | string | null | undefined, total: number | string | null | undefined): number {
    const t = +(total ?? 0);
    return t ? Math.min(100, (+(paid ?? 0) / t) * 100) : 0;
  }
}
