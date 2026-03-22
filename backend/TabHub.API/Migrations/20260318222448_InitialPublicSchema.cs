using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace TabHub.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialPublicSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // NOTE: public.tenants is created by db-init.sql (Docker entrypoint).
            // NOTE: Tenant-schema tables (spaces, staff, tables, etc.) are provisioned
            //       dynamically by SchemaProvisioner.cs — not managed here.

            migrationBuilder.EnsureSchema(
                name: "public");

            migrationBuilder.CreateTable(
                name: "managers",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    password_hash = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    display_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    is_super_admin = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("p_k_managers", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                schema: "public",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    manager_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    expires_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    revoked_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("p_k_refresh_tokens", x => x.id);
                    table.ForeignKey(
                        name: "f_k_refresh_tokens_managers_manager_id",
                        column: x => x.manager_id,
                        principalSchema: "public",
                        principalTable: "managers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "manager_tenants",
                schema: "public",
                columns: table => new
                {
                    manager_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("p_k_manager_tenants", x => new { x.manager_id, x.tenant_id });
                    table.ForeignKey(
                        name: "f_k_manager_tenants_managers_manager_id",
                        column: x => x.manager_id,
                        principalSchema: "public",
                        principalTable: "managers",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    // FK to public.tenants (pre-existing, created by db-init.sql)
                    table.ForeignKey(
                        name: "f_k_manager_tenants_tenants_tenant_id",
                        column: x => x.tenant_id,
                        principalSchema: "public",
                        principalTable: "tenants",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "i_x_managers_email",
                schema: "public",
                table: "managers",
                column: "email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "i_x_refresh_tokens_manager_id",
                schema: "public",
                table: "refresh_tokens",
                column: "manager_id");

            migrationBuilder.CreateIndex(
                name: "i_x_refresh_tokens_token_hash",
                schema: "public",
                table: "refresh_tokens",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "i_x_manager_tenants_tenant_id",
                schema: "public",
                table: "manager_tenants",
                column: "tenant_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "manager_tenants",
                schema: "public");

            migrationBuilder.DropTable(
                name: "refresh_tokens",
                schema: "public");

            migrationBuilder.DropTable(
                name: "managers",
                schema: "public");
        }
    }
}
