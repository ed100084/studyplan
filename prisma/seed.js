const { PrismaClient } = require("@prisma/client");
const textbookData = require("../data/alian-textbook-versions-114.json");

const prisma = new PrismaClient();

async function main() {
  const school = await prisma.school.upsert({
    where: { name: textbookData.school.name },
    update: { shortName: textbookData.school.shortName },
    create: {
      name: textbookData.school.name,
      shortName: textbookData.school.shortName,
    },
  });

  const academicYear = await prisma.academicYear.upsert({
    where: {
      schoolId_year: {
        schoolId: school.id,
        year: textbookData.academicYear,
      },
    },
    update: {},
    create: {
      schoolId: school.id,
      year: textbookData.academicYear,
    },
  });

  for (const grade of textbookData.grades) {
    const gradeLevel = await prisma.gradeLevel.upsert({
      where: {
        academicYearId_grade: {
          academicYearId: academicYear.id,
          grade: grade.grade,
        },
      },
      update: { label: grade.label },
      create: {
        academicYearId: academicYear.id,
        grade: grade.grade,
        label: grade.label,
      },
    });

    for (const subjectItem of grade.subjects) {
      const subject = await prisma.subject.upsert({
        where: { name: subjectItem.name },
        update: {},
        create: { name: subjectItem.name },
      });

      await prisma.textbookVersion.upsert({
        where: {
          gradeLevelId_subjectId: {
            gradeLevelId: gradeLevel.id,
            subjectId: subject.id,
          },
        },
        update: {
          publisher: subjectItem.publisher,
          sourceTitle: textbookData.source.title,
          sourceUrl: textbookData.source.url,
        },
        create: {
          gradeLevelId: gradeLevel.id,
          subjectId: subject.id,
          publisher: subjectItem.publisher,
          sourceTitle: textbookData.source.title,
          sourceUrl: textbookData.source.url,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

