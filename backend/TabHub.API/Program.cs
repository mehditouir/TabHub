using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using TabHub.API.API.Filters;
using TabHub.API.API.Swagger;
using TabHub.API.Infrastructure.Auth;
using TabHub.API.Infrastructure.Multitenancy;
using TabHub.API.Infrastructure.Persistence;
using TabHub.API.Infrastructure.Realtime;
using TabHub.API.Infrastructure.Services;

QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;

var builder = WebApplication.CreateBuilder(args);

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy
            .WithOrigins(
                builder.Configuration["Cors:AllowedOrigins"]?.Split(',')
                    ?? ["http://localhost:5173"])
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()); // required for SignalR WebSocket handshake
});

// ── Application Insights (Linux App Service requires explicit SDK) ─────────────
builder.Services.AddApplicationInsightsTelemetry();

// ── Controllers ───────────────────────────────────────────────────────────────
builder.Services.AddControllers(opts => opts.Filters.Add<TenantAuthorizationFilter>());

// ── Real-time ─────────────────────────────────────────────────────────────────
builder.Services.AddSignalR();

// ── Swagger ───────────────────────────────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "TabHub API", Version = "v1" });
    c.OperationFilter<TenantHeaderOperationFilter>();
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type        = SecuritySchemeType.Http,
        Scheme      = "bearer",
        BearerFormat = "JWT",
        Description = "Paste your JWT access token here",
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        [new OpenApiSecurityScheme
        {
            Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
        }] = [],
    });
});

// ── Database ──────────────────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// ── Multi-tenancy ─────────────────────────────────────────────────────────────
builder.Services.AddMemoryCache();
builder.Services.AddSingleton<TenantCache>();
builder.Services.AddScoped<SchemaProvisioner>();

// ── Authentication & Authorization ────────────────────────────────────────────
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwt = builder.Configuration.GetSection("Jwt");
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidIssuer              = jwt["Issuer"],
            ValidateAudience         = true,
            ValidAudience            = jwt["Audience"],
            ValidateIssuerSigningKey = true,
            IssuerSigningKey         = new SymmetricSecurityKey(
                                           Encoding.UTF8.GetBytes(jwt["Key"]!)),
            ValidateLifetime         = true,
            ClockSkew                = TimeSpan.FromSeconds(30),
            RoleClaimType            = "role",
            NameClaimType            = "sub",
        };
        // SignalR: browsers cannot send auth headers over WebSocket,
        // so read the access token from the query string instead.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                var token = ctx.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) &&
                    ctx.Request.Path.StartsWithSegments("/hubs"))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("ManagerOnly", p => p.RequireAuthenticatedUser()
        .RequireClaim("actor_type", "manager"));
    options.AddPolicy("OwnerOnly", p => p.RequireAuthenticatedUser()
        .RequireClaim("actor_type", "manager")
        .RequireRole("owner"));
});

// ── Auth infrastructure ───────────────────────────────────────────────────────
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentActor, CurrentActorAccessor>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddScoped<ArgonHasher>();
builder.Services.AddScoped<PinHasher>();

// ── Services ──────────────────────────────────────────────────────────────────
builder.Services.AddScoped<AuditService>();

// Image storage: use Azure Blob if configured, otherwise fall back to local filesystem
if (!string.IsNullOrWhiteSpace(builder.Configuration["AzureStorage:ConnectionString"]))
    builder.Services.AddScoped<IImageStorageService, BlobImageStorageService>();
else
    builder.Services.AddScoped<IImageStorageService, LocalImageStorageService>();

// ─────────────────────────────────────────────────────────────────────────────
var app = builder.Build();

// ── Auto-migrate on startup ───────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await db.Database.MigrateAsync();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!app.Environment.IsEnvironment("Testing"))
    app.UseHttpsRedirection();

app.UseStaticFiles();                  // serves wwwroot/uploads/ for local image storage
app.UseCors("Frontend");               // must be before auth middleware
app.UseMiddleware<TenantMiddleware>(); // 1st — resolves tenant + sets search_path
app.UseAuthentication();              // 2nd — reads JWT
app.UseAuthorization();               // 3rd — enforces policies

app.MapControllers();
app.MapHub<OrderHub>("/hubs/orders");
app.MapGet("/health", () => Results.Ok(new { status = "healthy" })).AllowAnonymous();

app.Run();

// Required for WebApplicationFactory<Program> in integration tests
public partial class Program { }
