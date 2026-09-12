import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PrestamosService } from './prestamos.service';
import { environment } from '../../environments/environment';
import { Prestamo, Cuota } from '../models/index';

describe('PrestamosService', () => {
  let service: PrestamosService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/prestamos`;

  const prestamos: Prestamo[] = [
    { id: 1, deudor_id: 1, monto_original: 1000 } as Prestamo,
    { id: 2, deudor_id: 2, monto_original: 2000 } as Prestamo,
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PrestamosService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAll devuelve el array directo si la API responde sin paginar', () => {
    service.getAll().subscribe(p => expect(p).toEqual(prestamos));
    httpMock.expectOne(url).flush(prestamos);
  });

  it('getAll extrae .data si la API devuelve respuesta paginada', () => {
    service.getAll().subscribe(p => expect(p).toEqual(prestamos));
    httpMock.expectOne(url).flush({ data: prestamos, total: 2, page: 1, limit: 20 });
  });

  it('getAll(deudorId) envía deudor_id como query param y cachea por esa clave', () => {
    service.getAll(1).subscribe(p => expect(p).toEqual([prestamos[0]]));
    const req = httpMock.expectOne(r => r.url === url && r.params.get('deudor_id') === '1');
    req.flush([prestamos[0]]);

    // Segunda llamada con la misma clave usa la cache (no hay nueva petición)
    service.getAll(1).subscribe(p => expect(p).toEqual([prestamos[0]]));
    httpMock.expectNone(r => r.url === url && r.params.get('deudor_id') === '1');
  });

  it('getCuotas obtiene el cronograma de un préstamo', () => {
    const cuotas: Cuota[] = [{ id: 1, prestamo_id: 1, numero_cuota: 1 } as Cuota];
    service.getCuotas(1).subscribe(c => expect(c).toEqual(cuotas));
    httpMock.expectOne(`${url}/1/cuotas`).flush(cuotas);
  });

  it('create invalida la cache de getAll', () => {
    service.getAll().subscribe();
    httpMock.expectOne(url).flush(prestamos);

    service.create({ deudor_id: 1, monto_original: 500 }).subscribe();
    httpMock.expectOne(url).flush({ id: 3, deudor_id: 1, monto_original: 500 });

    service.getAll().subscribe();
    httpMock.expectOne(url).flush(prestamos);
  });

  it('update hace PATCH y invalida la cache', () => {
    service.update(1, { estado: 'pagado' as Prestamo['estado'] }).subscribe();
    const req = httpMock.expectOne(`${url}/1`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ ...prestamos[0], estado: 'pagado' });
  });
});
