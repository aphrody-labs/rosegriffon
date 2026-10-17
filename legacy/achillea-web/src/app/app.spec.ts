import { signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { App } from "./app";
import { appConfig } from "./app.config";
import { UserService } from "./shared/services/user-service";

const anonymousUser = {
	user: signal(undefined),
	userHasClan: signal(false),
	userIsAdmin: () => false,
	userNotifications: signal([]),
	loadUserIfNeeded: async () => undefined,
	handleLogin: () => undefined,
	logOut: async () => undefined,
	markUserNotificationsAsRead: async () => true,
};

describe("App", () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [App],
			providers: [appConfig.providers ?? [], { provide: UserService, useValue: anonymousUser }],
		}).compileComponents();
	});

	it("should create the app", () => {
		const fixture = TestBed.createComponent(App);
		const app = fixture.componentInstance;
		expect(app).toBeTruthy();
	});

	it("should render the application shell", () => {
		const fixture = TestBed.createComponent(App);
		fixture.detectChanges();
		const compiled = fixture.nativeElement as HTMLElement;
		expect(compiled.querySelector("app-header")).toBeTruthy();
		expect(compiled.querySelector("router-outlet")).toBeTruthy();
		expect(compiled.querySelector("app-footer")).toBeTruthy();
	});
});
