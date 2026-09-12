import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PagosService } from './pagos.service';
import { environment } from '../../environments/environment';
import { Pago } from '../models/index';

describe('PagosService', () => {
  let service: PagosService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/pagos`;

  const pagos: Pago[] = [
    { id: 1, monto: 100, fecha_pago: '2026-01-01' } as Pago,
    { id: 2, monto: 200, fecha_pago: '2026-01-02' } as Pago,
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PagosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAll normaliza una respuesta paginada', () => {
    service.getAll().subscribe(res => {
      expect(res.data).toEqual(pagos);
      expect(res.total).toBe(2);
      expect(res.page).toBe(1);
      expect(res.limit).toBe(20);
    });
    httpMock.expectOne(url).flush({ data: pagos, total: 2, page: 1, limit: 20 });
  });

  it('getAll normaliza una respuesta en array plano', () => {
    service.getAll().subscribe(res => {
      expect(res.data).toEqual(pagos);
      expect(res.total).toBe(2);
      expect(res.page).toBe(1);
      expect(res.limit).toBe(2);
    });
    httpMock.expectOne(url).flush(pagos);
  });

  it('getAll envía los filtros como query params', () => {
    service.getAll({ deudor_id: 5, metodo: 'efectivo', page: 2, limit: 10 }).subscribe();
    const req = httpMock.expectOne(r =>
      r.url === url &&
      r.params.get('deudor_id') === '5' &&
      r.params.get('metodo') === 'efectivo' &&
      r.params.get('page') === '2' &&
      r.params.get('limit') === '10'
    );
    req.flush([]);
  });

  it('getResumen normaliza claves camelCase', () => {
    service.getResumen().subscribe(res => {
      expect(res.porDeudor).toEqual([
        { id: 1, nombre: 'Ana', total_pagado: 100, total_prestado: 200, ultimo_pago: '2026-01-01', num_pagos: 3 },
      ]);
      expect(res.porMetodo).toEqual([{ metodo_pago: 'efectivo', cantidad: 2, total: 100 }]);
      expect(res.porMes).toEqual([{ mes: '2026-01', total: 100, pagos: 2 }]);
      expect(res.totales).toEqual({ total_cobrado: 100, total_prestado: 200 });
    });
    httpMock.expectOne(`${url}/resumen`).flush({
      porDeudor: [{ id: 1, nombre: 'Ana', total_pagado: 100, total_prestado: 200, ultimo_pago: '2026-01-01', num_pagos: 3 }],
      porMetodo: [{ metodo_pago: 'efectivo', cantidad: 2, total: 100 }],
      porMes: [{ mes: '2026-01', total: 100, pagos: 2 }],
      totales: { total_cobrado: 100, total_prestado: 200 },
    });
  });

  it('getResumen normaliza claves snake_case', () => {
    service.getResumen().subscribe(res => {
      expect(res.porDeudor).toEqual([
        { id: 1, nombre: 'Ana', total_pagado: 100, total_prestado: 200, ultimo_pago: '2026-01-01', num_pagos: 3 },
      ]);
      expect(res.porMetodo).toEqual([{ metodo_pago: 'efectivo', cantidad: 2, total: 100 }]);
      expect(res.porMes).toEqual([{ mes: '2026-01', total: 100, pagos: 2 }]);
      expect(res.totales).toEqual({ total_cobrado: 0, total_prestado: 0 });
    });
    httpMock.expectOne(`${url}/resumen`).flush({
      por_deudor: [{ id: 1, nombre: 'Ana', total_pagado: 100, total_prestado: 200, ultimo_pago: '2026-01-01', num_pagos: 3 }],
      por_metodo: [{ metodo: 'efectivo', cantidad: 2, total: 100 }],
      por_mes: [{ mes: '2026-01', total: 100, pagos: 2 }],
    });
  });

  it('getResumen cachea la respuesta dentro del TTL', () => {
    service.getResumen().subscribe();
    httpMock.expectOne(`${url}/resumen`).flush({});

    service.getResumen().subscribe();
    httpMock.expectNone(`${url}/resumen`);

    service.getResumen(true).subscribe();
    httpMock.expectOne(`${url}/resumen`).flush({});
  });
});
