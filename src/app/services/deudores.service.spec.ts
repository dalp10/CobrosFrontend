import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { DeudoresService } from './deudores.service';
import { environment } from '../../environments/environment';
import { Deudor } from '../models/index';

describe('DeudoresService', () => {
  let service: DeudoresService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/deudores`;

  const deudores: Deudor[] = [
    { id: 1, nombre: 'Ana', apellidos: 'Lopez' } as Deudor,
    { id: 2, nombre: 'Bruno', apellidos: 'Diaz' } as Deudor,
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DeudoresService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('getAll extrae .data si la API devuelve respuesta paginada', () => {
    service.getAll().subscribe(d => expect(d).toEqual(deudores));
    httpMock.expectOne(url).flush({ data: deudores, total: 2, page: 1, limit: 20 });
  });

  it('getAll devuelve el array directo si la API responde sin paginar', () => {
    service.getAll().subscribe(d => expect(d).toEqual(deudores));
    httpMock.expectOne(url).flush(deudores);
  });

  it('getAll cachea la respuesta y no repite la petición HTTP dentro del TTL', () => {
    service.getAll().subscribe();
    httpMock.expectOne(url).flush(deudores);

    service.getAll().subscribe(d => expect(d).toEqual(deudores));
    httpMock.expectNone(url);
  });

  it('getAll(true) ignora la cache y vuelve a pedir al backend', () => {
    service.getAll().subscribe();
    httpMock.expectOne(url).flush(deudores);

    service.getAll(true).subscribe();
    httpMock.expectOne(url).flush(deudores);
  });

  it('create invalida la cache', () => {
    service.getAll().subscribe();
    httpMock.expectOne(url).flush(deudores);

    service.create({ nombre: 'Carla', apellidos: 'Ruiz' }).subscribe();
    httpMock.expectOne(url).flush({ id: 3, nombre: 'Carla', apellidos: 'Ruiz' });

    service.getAll().subscribe();
    httpMock.expectOne(url).flush(deudores);
  });
});
