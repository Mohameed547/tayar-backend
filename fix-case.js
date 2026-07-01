import { execSync } from "child_process";
import fs from "fs";
import path from "path";

// الملفات اللي محتاجة rename (من حروف كبيرة لصغيرة)
const filesToRename = [
  // Drivers folder
  {
    old: "src/modules/Drivers/drivers.controller.js",
    new: "src/modules/drivers/drivers.controller.js",
  },
  {
    old: "src/modules/Drivers/drivers.routes.js",
    new: "src/modules/drivers/drivers.routes.js",
  },
  {
    old: "src/modules/Drivers/drivers.service.js",
    new: "src/modules/drivers/drivers.service.js",
  },
  {
    old: "src/modules/Drivers/drivers.validation.js",
    new: "src/modules/drivers/drivers.validation.js",
  },

  // Escrow folder
  {
    old: "src/modules/Escrow/escrow.controller.js",
    new: "src/modules/escrow/escrow.controller.js",
  },
  {
    old: "src/modules/Escrow/escrow.routes.js",
    new: "src/modules/escrow/escrow.routes.js",
  },
  {
    old: "src/modules/Escrow/escrow.service.js",
    new: "src/modules/escrow/escrow.service.js",
  },

  // Admin dashboard
  {
    old: "src/modules/admin/dashboard/Admin.dashboard.controller.js",
    new: "src/modules/admin/dashboard/admin.dashboard.controller.js",
  },
  {
    old: "src/modules/admin/dashboard/Admin.dashboard.routes.js",
    new: "src/modules/admin/dashboard/admin.dashboard.routes.js",
  },
  {
    old: "src/modules/admin/dashboard/Admin.dashboard.service.js",
    new: "src/modules/admin/dashboard/admin.dashboard.service.js",
  },

  // Admin offices
  {
    old: "src/modules/admin/offices/Admin.offices.controller.js",
    new: "src/modules/admin/offices/admin.offices.controller.js",
  },
  {
    old: "src/modules/admin/offices/Admin.offices.routes.js",
    new: "src/modules/admin/offices/admin.offices.routes.js",
  },
  {
    old: "src/modules/admin/offices/Admin.offices.service.js",
    new: "src/modules/admin/offices/admin.offices.service.js",
  },
  {
    old: "src/modules/admin/offices/Admin.offices.validation.js",
    new: "src/modules/admin/offices/admin.offices.validation.js",
  },

  // Admin setting
  {
    old: "src/modules/admin/setting/Settings.controller.js",
    new: "src/modules/admin/setting/settings.controller.js",
  },
  {
    old: "src/modules/admin/setting/Settings.routes.js",
    new: "src/modules/admin/setting/settings.routes.js",
  },
  {
    old: "src/modules/admin/setting/Settings.service.js",
    new: "src/modules/admin/setting/settings.service.js",
  },

  // Admin users
  {
    old: "src/modules/admin/users/Admin.users.controller.js",
    new: "src/modules/admin/users/admin.users.controller.js",
  },
  {
    old: "src/modules/admin/users/Admin.users.routes.js",
    new: "src/modules/admin/users/admin.users.routes.js",
  },
  {
    old: "src/modules/admin/users/Admin.users.service.js",
    new: "src/modules/admin/users/admin.users.service.js",
  },
  {
    old: "src/modules/admin/users/Admin.users.validation.js",
    new: "src/modules/admin/users/admin.users.validation.js",
  },
];

// الـ imports اللي محتاجة تتصلح في كل الملفات
const importFixes = [
  // index.js
  {
    file: "src/routes/index.js",
    replacements: [
      {
        from: "../modules/Drivers/drivers.routes.js",
        to: "../modules/drivers/drivers.routes.js",
      },
      {
        from: "../modules/Escrow/escrow.routes.js",
        to: "../modules/escrow/escrow.routes.js",
      },
      {
        from: "../modules/admin/users/Admin.users.routes.js",
        to: "../modules/admin/users/admin.users.routes.js",
      },
      {
        from: "../modules/admin/setting/Settings.routes.js",
        to: "../modules/admin/setting/settings.routes.js",
      },
      {
        from: "../modules/admin/offices/Admin.offices.routes.js",
        to: "../modules/admin/offices/admin.offices.routes.js",
      },
      {
        from: "../modules/admin/dashboard/admin.dashboard.routes.js",
        to: "../modules/admin/dashboard/admin.dashboard.routes.js",
      },
      {
        from: "../modules/admin/dashboard/Admin.dashboard.routes.js",
        to: "../modules/admin/dashboard/admin.dashboard.routes.js",
      },
    ],
  },
  // admin users routes
  {
    file: "src/modules/admin/users/admin.users.routes.js",
    replacements: [
      {
        from: "./admin.users.validation.js",
        to: "./admin.users.validation.js",
      },
      {
        from: "./Admin.users.validation.js",
        to: "./admin.users.validation.js",
      },
      {
        from: "./admin.users.controller.js",
        to: "./admin.users.controller.js",
      },
      {
        from: "./Admin.users.controller.js",
        to: "./admin.users.controller.js",
      },
    ],
  },
  // admin users controller
  {
    file: "src/modules/admin/users/admin.users.controller.js",
    replacements: [
      { from: "./admin.users.service.js", to: "./admin.users.service.js" },
      { from: "./Admin.users.service.js", to: "./admin.users.service.js" },
    ],
  },
  // admin offices routes
  {
    file: "src/modules/admin/offices/admin.offices.routes.js",
    replacements: [
      {
        from: "./admin.offices.validation.js",
        to: "./admin.offices.validation.js",
      },
      {
        from: "./Admin.offices.validation.js",
        to: "./admin.offices.validation.js",
      },
      {
        from: "./admin.offices.controller.js",
        to: "./admin.offices.controller.js",
      },
      {
        from: "./Admin.offices.controller.js",
        to: "./admin.offices.controller.js",
      },
    ],
  },
  // admin offices controller
  {
    file: "src/modules/admin/offices/admin.offices.controller.js",
    replacements: [
      { from: "./admin.offices.service.js", to: "./admin.offices.service.js" },
      { from: "./Admin.offices.service.js", to: "./admin.offices.service.js" },
    ],
  },
  // admin dashboard routes
  {
    file: "src/modules/admin/dashboard/admin.dashboard.routes.js",
    replacements: [
      {
        from: "./admin.dashboard.controller.js",
        to: "./admin.dashboard.controller.js",
      },
      {
        from: "./Admin.dashboard.controller.js",
        to: "./admin.dashboard.controller.js",
      },
    ],
  },
  // admin dashboard controller
  {
    file: "src/modules/admin/dashboard/admin.dashboard.controller.js",
    replacements: [
      {
        from: "./admin.dashboard.service.js",
        to: "./admin.dashboard.service.js",
      },
      {
        from: "./Admin.dashboard.service.js",
        to: "./admin.dashboard.service.js",
      },
    ],
  },
  // settings routes
  {
    file: "src/modules/admin/setting/settings.routes.js",
    replacements: [
      { from: "./settings.controller.js", to: "./settings.controller.js" },
      { from: "./Settings.controller.js", to: "./settings.controller.js" },
    ],
  },
  // settings controller
  {
    file: "src/modules/admin/setting/settings.controller.js",
    replacements: [
      { from: "./settings.service.js", to: "./settings.service.js" },
      { from: "./Settings.service.js", to: "./settings.service.js" },
    ],
  },
];

console.log("🚀 بدأنا نصلح المشكلة...\n");

// Step 1: rename الملفات عن طريق git mv
console.log("📁 Step 1: Renaming files...");
for (const f of filesToRename) {
  try {
    // عشان git على Windows محتاج نعمل rename لاسم مؤقت الأول
    const tmpName = f.old + ".tmp";
    execSync(`git mv "${f.old}" "${tmpName}"`, { stdio: "pipe" });
    execSync(`git mv "${tmpName}" "${f.new}"`, { stdio: "pipe" });
    console.log(`  ✅ ${f.old} → ${f.new}`);
  } catch (e) {
    console.log(`  ⚠️  ${f.old} - ${e.message.trim()}`);
  }
}

// Step 2: صلح الـ imports
console.log("\n📝 Step 2: Fixing imports...");
for (const item of importFixes) {
  try {
    if (!fs.existsSync(item.file)) {
      console.log(`  ⚠️  File not found: ${item.file}`);
      continue;
    }
    let content = fs.readFileSync(item.file, "utf8");
    let changed = false;
    for (const r of item.replacements) {
      if (content.includes(r.from)) {
        content = content.split(r.from).join(r.to);
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync(item.file, content, "utf8");
      console.log(`  ✅ Fixed imports in: ${item.file}`);
    }
  } catch (e) {
    console.log(`  ⚠️  ${item.file} - ${e.message}`);
  }
}

// Step 3: git add وcommit
console.log("\n📦 Step 3: Committing...");
try {
  execSync("git add -A", { stdio: "inherit" });
  execSync(
    'git commit -m "fix: rename all files to lowercase and fix imports"',
    { stdio: "inherit" },
  );
  execSync("git push", { stdio: "inherit" });
  console.log("\n✅ تم! Railway هتعمل redeploy أوتوماتيك 🚀");
} catch (e) {
  console.log("\n⚠️  Git error:", e.message);
}
