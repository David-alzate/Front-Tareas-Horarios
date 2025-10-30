import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';

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
          Gestiona el estado general de las tareas y genera tareas automáticas de limpieza en un solo lugar.
        </p>
      </header>

      <section class="card">
        <div class="card-header">
          <h2>Tareas registradas</h2>
          <button type="button" (click)="loadTasks()" [disabled]="taskLoading()">
            {{ taskLoading() ? 'Cargando…' : 'Actualizar listado' }}
          </button>
        </div>

        <form class="form-grid" [formGroup]="taskForm" (ngSubmit)="createTask()">
          <h3>Crear nueva tarea</h3>
          <div class="form-row">
            <label for="description">Descripción</label>
            <input
              id="description"
              type="text"
              placeholder="Ej. Inspeccionar habitación 205"
              formControlName="description"
              [class.invalid]="fieldInvalid(taskForm, 'description')"
              autocomplete="off"
            />
            <small *ngIf="fieldInvalid(taskForm, 'description')">La descripción es obligatoria.</small>
          </div>

          <div class="form-row">
            <label for="assignedEmployee">Empleado asignado</label>
            <input
              id="assignedEmployee"
              type="text"
              placeholder="Ej. Ana Torres"
              formControlName="assignedEmployee"
              [class.invalid]="fieldInvalid(taskForm, 'assignedEmployee')"
              autocomplete="off"
            />
            <small *ngIf="fieldInvalid(taskForm, 'assignedEmployee')">Debes especificar a quién asignas la tarea.</small>
          </div>

          <div class="form-row">
            <label for="status">Estado</label>
            <select id="status" formControlName="status">
              <option *ngFor="let option of statusOptions" [value]="option">
                {{ option }}
              </option>
            </select>
          </div>

          <button type="submit" [disabled]="taskCreationLoading()">
            {{ taskCreationLoading() ? 'Guardando…' : 'Crear tarea' }}
          </button>
        </form>

        <p *ngIf="taskCreationError()" class="error">{{ taskCreationError() }}</p>
        <p *ngIf="taskCreationMessage()" class="info">{{ taskCreationMessage() }}</p>
        <p *ngIf="taskUpdateError()" class="error">{{ taskUpdateError() }}</p>
        <p *ngIf="taskUpdateMessage()" class="info">{{ taskUpdateMessage() }}</p>
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
                <th>Actualizar estado</th>
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
                <td>
                  <div class="status-actions">
                    <select
                      [value]="statusSelections()[task.taskId] ?? task.status"
                      (change)="onStatusSelect(task.taskId, $any($event.target).value)"
                    >
                      <option *ngFor="let option of statusOptions" [value]="option">
                        {{ option }}
                      </option>
                    </select>
                    <button
                      type="button"
                      (click)="updateTaskStatus(task)"
                      [disabled]="taskUpdateLoading() === task.taskId || !shouldEnableUpdate(task.taskId, task.status)"
                    >
                      {{ taskUpdateLoading() === task.taskId ? 'Actualizando…' : 'Actualizar' }}
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="card-header">
          <h2>Tareas de limpieza automáticas</h2>
        </div>

        <form class="form-grid" [formGroup]="cleaningForm" (ngSubmit)="createCleaningTask()">
          <h3>Generar o recuperar tarea de limpieza</h3>
          <div class="form-row">
            <label for="hotelName">Hotel</label>
            <input
              id="hotelName"
              type="text"
              placeholder="Ej. Hotel Central"
              formControlName="hotelName"
              [class.invalid]="fieldInvalid(cleaningForm, 'hotelName')"
              autocomplete="off"
            />
            <small *ngIf="fieldInvalid(cleaningForm, 'hotelName')">El nombre del hotel es obligatorio.</small>
          </div>

          <div class="form-row">
            <label for="roomCode">Habitación</label>
            <input
              id="roomCode"
              type="text"
              placeholder="Ej. 305"
              formControlName="roomCode"
              [class.invalid]="fieldInvalid(cleaningForm, 'roomCode')"
              autocomplete="off"
            />
            <small *ngIf="fieldInvalid(cleaningForm, 'roomCode')">El código de habitación es obligatorio.</small>
          </div>

          <div class="form-row">
            <label for="newStatus">Estado tras el checkout</label>
            <input id="newStatus" type="text" formControlName="newStatus" readonly />
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

  private readonly apiBaseUrl = 'http://localhost:8081';

  protected readonly statusOptions = ['Pendiente', 'En progreso', 'Completada'];
  protected readonly statusSelections = signal<Partial<Record<string, string>>>({});

  protected readonly tasks = signal<TaskResponse[]>([]);
  protected readonly taskLoading = signal(false);
  protected readonly taskError = signal<string | null>(null);

  protected readonly taskCreationLoading = signal(false);
  protected readonly taskCreationError = signal<string | null>(null);
  protected readonly taskCreationMessage = signal<string | null>(null);

  protected readonly taskUpdateLoading = signal<string | null>(null);
  protected readonly taskUpdateError = signal<string | null>(null);
  protected readonly taskUpdateMessage = signal<string | null>(null);

  protected readonly cleaningTasks = signal<CleaningTaskView[]>([]);
  protected readonly cleaningLoading = signal(false);
  protected readonly cleaningError = signal<string | null>(null);
  protected readonly cleaningMessage = signal<string | null>(null);

  protected readonly taskForm = this.fb.group({
    description: ['', Validators.required],
    assignedEmployee: ['', Validators.required],
    status: ['Pendiente', Validators.required]
  });

  protected readonly cleaningForm = this.fb.group({
    hotelName: ['', Validators.required],
    roomCode: ['', Validators.required],
    newStatus: [{ value: 'Disponible', disabled: false }, Validators.required]
  });

  ngOnInit(): void {
    this.loadTasks();
  }

  protected createTask(): void {
    if (this.taskForm.invalid) {
      this.taskForm.markAllAsTouched();
      return;
    }

    const payload = this.taskForm.getRawValue();

    this.taskCreationLoading.set(true);
    this.taskCreationError.set(null);
    this.taskCreationMessage.set(null);
    this.taskUpdateMessage.set(null);
    this.taskUpdateError.set(null);

    this.http.post<TaskResponse>(`${this.apiBaseUrl}/tasks/create`, payload).subscribe({
      next: (response) => {
        this.taskCreationLoading.set(false);
        this.taskCreationMessage.set('Tarea creada correctamente.');
        this.taskForm.reset({
          description: '',
          assignedEmployee: '',
          status: 'Pendiente'
        });
        const current = this.tasks();
        const updatedTasks = [response, ...current];
        this.tasks.set(updatedTasks);
        this.statusSelections.set(this.buildStatusSelections(updatedTasks));
      },
      error: (error) => {
        this.taskCreationLoading.set(false);
        const message = this.resolveErrorMessage(error);
        this.taskCreationError.set(message);
      }
    });
  }

  protected loadTasks(): void {
    this.taskLoading.set(true);
    this.taskError.set(null);
    this.taskUpdateMessage.set(null);
    this.taskUpdateError.set(null);

    this.http.get<TaskResponse[]>(`${this.apiBaseUrl}/tasks/all`).subscribe({
      next: (response) => {
        const data = response ?? [];
        this.tasks.set(data);
        this.statusSelections.set(this.buildStatusSelections(data));
        this.taskLoading.set(false);
      },
      error: (error) => {
        const message = this.resolveErrorMessage(error);
        this.taskError.set(message);
        this.tasks.set([]);
        this.statusSelections.set({});
        this.taskLoading.set(false);
      }
    });
  }

  protected onStatusSelect(taskId: string, newStatus: string): void {
    const currentSelections = { ...this.statusSelections() };
    currentSelections[taskId] = newStatus;
    this.statusSelections.set(currentSelections);
    this.taskUpdateMessage.set(null);
    this.taskUpdateError.set(null);
  }

  protected shouldEnableUpdate(taskId: string, currentStatus: string): boolean {
    const selected = this.statusSelections()[taskId] ?? currentStatus;
    return selected !== currentStatus;
  }

  protected updateTaskStatus(task: TaskResponse): void {
    const targetStatus = this.statusSelections()[task.taskId] ?? task.status;
    if (!targetStatus || targetStatus === task.status) {
      return;
    }

    this.taskUpdateLoading.set(task.taskId);
    this.taskUpdateError.set(null);
    this.taskUpdateMessage.set(null);

    const payload = {
      ...task,
      status: targetStatus
    };

    this.http
      .put<TaskResponse>(`${this.apiBaseUrl}/tasks/update/${task.taskId}`, payload)
      .subscribe({
        next: (response) => {
          this.taskUpdateLoading.set(null);
          this.taskUpdateMessage.set('Estado actualizado correctamente.');
          const updatedTasks = this.tasks().map((item) =>
            item.taskId === response.taskId ? { ...item, ...response } : item
          );
          this.tasks.set(updatedTasks);
          this.statusSelections.set(this.buildStatusSelections(updatedTasks));
        },
        error: (error) => {
          this.taskUpdateLoading.set(null);
          const message = this.resolveErrorMessage(error);
          this.taskUpdateError.set(message);
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

  protected fieldInvalid(form: FormGroup, field: string): boolean {
    const control = form.get(field);
    return !!control && control.invalid && (control.dirty || control.touched);
  }

  private buildStatusSelections(tasks: TaskResponse[]): Partial<Record<string, string>> {
    return tasks.reduce((acc, task) => {
      acc[task.taskId] = task.status;
      return acc;
    }, {} as Partial<Record<string, string>>);
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
