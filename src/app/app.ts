import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

interface TaskResponse {
  taskId: string;
  description: string;
  assignedEmployee: string;
  status: string;
  startTime?: string | null;
  endTime?: string | null;
}

interface AutomaticCleaningTaskResponse {
  success: boolean;
  message?: string | null;
  taskId?: number | null;
  hotelName?: string | null;
  roomCode?: string | null;
  description?: string | null;
  assignedTo?: string | null;
  estimatedMinutes?: number | null;
  status?: string | null;
  createdAt?: string | null;
  error?: string | null;
}

interface CleaningTaskView {
  taskId: number | null | undefined;
  hotelName: string | null | undefined;
  roomCode: string | null | undefined;
  description: string | null | undefined;
  assignedTo: string | null | undefined;
  estimatedMinutes: number | null | undefined;
  status: string | null | undefined;
  createdAt: string | null | undefined;
  message: string | null | undefined;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="container">
      <header class="page-header">
        <h1>Monitoreo de tareas</h1>
        <p>
          Consulta el estado general de las tareas y genera tareas automáticas de limpieza desde un único lugar.
        </p>
      </header>

      <section class="card">
        <div class="card-header">
          <h2>Tareas registradas</h2>
          <button type="button" (click)="loadTasks()" [disabled]="taskLoading()">
            {{ taskLoading() ? 'Cargando…' : 'Actualizar listado' }}
          </button>
        </div>

        <form class="token-form" [formGroup]="tokenForm" (ngSubmit)="applyToken()">
          <label for="token">Token JWT</label>
          <div class="token-input">
            <input
              id="token"
              type="text"
              placeholder="Pega aquí un token válido para el microservicio"
              formControlName="token"
              autocomplete="off"
            />
            <button type="submit">Guardar token</button>
          </div>
          <small>El servicio de tareas exige autenticación. Puedes reutilizar cualquier token JWT emitido por el backend.</small>
        </form>

        <p *ngIf="taskError()" class="error">{{ taskError() }}</p>
        <p *ngIf="!taskLoading() && !taskError() && !tasks().length" class="empty">
          No hay tareas registradas en este momento.
        </p>

        <div class="table-wrapper" *ngIf="tasks().length">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Descripción</th>
                <th>Empleado asignado</th>
                <th>Estado</th>
                <th>Inicio</th>
                <th>Fin</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let task of tasks(); trackBy: trackByTaskId">
                <td>{{ task.taskId }}</td>
                <td>{{ task.description }}</td>
                <td>{{ task.assignedEmployee }}</td>
                <td>{{ task.status }}</td>
                <td>{{ task.startTime ? (task.startTime | date: 'short') : '—' }}</td>
                <td>{{ task.endTime ? (task.endTime | date: 'short') : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <h2>Tareas de limpieza automáticas</h2>
        </div>

        <form class="cleaning-form" [formGroup]="cleaningForm" (ngSubmit)="createCleaningTask()">
          <div class="form-row">
            <label for="hotelName">Hotel</label>
            <input
              id="hotelName"
              type="text"
              placeholder="Ej. Hotel Central"
              formControlName="hotelName"
              [class.invalid]="fieldInvalid('hotelName')"
              autocomplete="off"
            />
            <small *ngIf="fieldInvalid('hotelName')">El nombre del hotel es obligatorio.</small>
          </div>

          <div class="form-row">
            <label for="roomCode">Habitación</label>
            <input
              id="roomCode"
              type="text"
              placeholder="Ej. 305"
              formControlName="roomCode"
              [class.invalid]="fieldInvalid('roomCode')"
              autocomplete="off"
            />
            <small *ngIf="fieldInvalid('roomCode')">El código de habitación es obligatorio.</small>
          </div>

          <div class="form-row">
            <label for="newStatus">Estado tras el checkout</label>
            <input
              id="newStatus"
              type="text"
              formControlName="newStatus"
              readonly
            />
          </div>

          <button type="submit" [disabled]="cleaningLoading()">
            {{ cleaningLoading() ? 'Generando…' : 'Generar/ver tarea' }}
          </button>
        </form>

        <p *ngIf="cleaningError()" class="error">{{ cleaningError() }}</p>
        <p *ngIf="cleaningMessage()" class="info">{{ cleaningMessage() }}</p>

        <div class="table-wrapper" *ngIf="cleaningTasks().length">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Hotel</th>
                <th>Habitación</th>
                <th>Descripción</th>
                <th>Asignada a</th>
                <th>Estimado (min)</th>
                <th>Estado</th>
                <th>Creación</th>
                <th>Mensaje</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let task of cleaningTasks(); trackBy: trackByCleaningId">
                <td>{{ task.taskId ?? '—' }}</td>
                <td>{{ task.hotelName }}</td>
                <td>{{ task.roomCode }}</td>
                <td>{{ task.description }}</td>
                <td>{{ task.assignedTo }}</td>
                <td>{{ task.estimatedMinutes ?? '—' }}</td>
                <td>{{ task.status }}</td>
                <td>{{ task.createdAt ? (task.createdAt | date: 'short') : '—' }}</td>
                <td>{{ task.message }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p *ngIf="!cleaningTasks().length && !cleaningError()" class="hint">
          Genera una tarea para ver el registro más reciente asociado a la habitación seleccionada.
        </p>
      </section>
    </main>
  `,
  styles: []
})
export class App implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);

  private authToken = '';
  private readonly apiBaseUrl = 'http://localhost:8081';

  protected readonly tasks = signal<TaskResponse[]>([]);
  protected readonly taskLoading = signal(false);
  protected readonly taskError = signal<string | null>(null);

  protected readonly cleaningTasks = signal<CleaningTaskView[]>([]);
  protected readonly cleaningLoading = signal(false);
  protected readonly cleaningError = signal<string | null>(null);
  protected readonly cleaningMessage = signal<string | null>(null);

  protected readonly tokenForm = this.fb.group({
    token: ['']
  });

  protected readonly cleaningForm = this.fb.group({
    hotelName: ['', Validators.required],
    roomCode: ['', Validators.required],
    newStatus: [{ value: 'Disponible', disabled: false }, Validators.required]
  });

  ngOnInit(): void {
    const tokenValue = this.tokenForm.value.token?.trim();
    if (tokenValue) {
      this.authToken = tokenValue;
      this.loadTasks();
    }
  }

  protected applyToken(): void {
    const tokenValue = this.tokenForm.value.token?.trim();
    this.authToken = tokenValue ?? '';
    if (!this.authToken) {
      this.taskError.set('Debes proporcionar un token JWT para consultar las tareas.');
      this.tasks.set([]);
      return;
    }
    this.loadTasks();
  }

  protected loadTasks(): void {
    if (!this.authToken) {
      this.taskError.set('Debes proporcionar un token JWT para consultar las tareas.');
      this.tasks.set([]);
      return;
    }

    this.taskLoading.set(true);
    this.taskError.set(null);

    this.http
      .get<TaskResponse[]>(`${this.apiBaseUrl}/tasks/all`, { headers: this.buildAuthHeaders() })
      .subscribe({
        next: (response) => {
          this.tasks.set(response ?? []);
          this.taskLoading.set(false);
        },
        error: (error) => {
          const message = this.resolveErrorMessage(error);
          this.taskError.set(message);
          this.tasks.set([]);
          this.taskLoading.set(false);
        }
      });
  }

  protected createCleaningTask(): void {
    if (this.cleaningForm.invalid) {
      this.cleaningForm.markAllAsTouched();
      return;
    }

    const { hotelName, roomCode, newStatus } = this.cleaningForm.getRawValue();

    this.cleaningLoading.set(true);
    this.cleaningError.set(null);
    this.cleaningMessage.set(null);

    this.http
      .post<AutomaticCleaningTaskResponse>(`${this.apiBaseUrl}/api/v1/automatic-cleaning-tasks`, {
        hotelName,
        roomCode,
        newStatus
      })
      .subscribe({
        next: (response) => {
          this.cleaningLoading.set(false);

          if (response.success) {
            const task: CleaningTaskView = {
              taskId: response.taskId,
              hotelName: response.hotelName,
              roomCode: response.roomCode,
              description: response.description,
              assignedTo: response.assignedTo,
              estimatedMinutes: response.estimatedMinutes,
              status: response.status,
              createdAt: response.createdAt,
              message: response.message
            };

            const current = this.cleaningTasks();
            this.cleaningTasks.set([task, ...current]);
            this.cleaningMessage.set(response.message ?? 'Tarea de limpieza obtenida correctamente.');
          } else {
            this.cleaningError.set(response.error ?? 'No fue posible generar la tarea automática.');
          }
        },
        error: (error) => {
          this.cleaningLoading.set(false);
          const message = this.resolveErrorMessage(error);
          this.cleaningError.set(message);
        }
      });
  }

  protected trackByTaskId(_: number, item: TaskResponse): string {
    return item.taskId;
  }

  protected trackByCleaningId(_: number, item: CleaningTaskView): number | string {
    return item.taskId ?? `${item.hotelName}-${item.roomCode}-${item.createdAt}`;
  }

  protected fieldInvalid(field: 'hotelName' | 'roomCode'): boolean {
    const control = this.cleaningForm.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private buildAuthHeaders(): HttpHeaders {
    return this.authToken
      ? new HttpHeaders({ Authorization: `Bearer ${this.authToken}` })
      : new HttpHeaders();
  }

  private resolveErrorMessage(error: unknown): string {
    if (!error) {
      return 'Se produjo un error desconocido.';
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error instanceof Error) {
      return error.message;
    }

    const maybeResponse = error as { status?: number; error?: { message?: string; error?: string } | string };

    if (maybeResponse?.status === 401) {
      return 'No autorizado. Verifica el token configurado.';
    }

    if (maybeResponse?.status === 0) {
      return 'No fue posible conectar con el servicio. Asegúrate de que esté disponible en el puerto 8081.';
    }

    if (typeof maybeResponse?.error === 'string') {
      return maybeResponse.error;
    }

    if (maybeResponse?.error && typeof maybeResponse.error === 'object') {
      return maybeResponse.error.message || maybeResponse.error.error || 'Ocurrió un error en la solicitud.';
    }

    return 'Ocurrió un error en la solicitud.';
  }
}
