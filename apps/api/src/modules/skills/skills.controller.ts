import { Controller, Get, Header, NotFoundException, Param } from '@nestjs/common';
import fs from 'node:fs';
import path from 'node:path';

const skillFileById: Record<string, string> = {
  buy: 'testcoin-buy-skill.json',
  'testcoin-buy-skill': 'testcoin-buy-skill.json',
  'get-test-faucet': 'get-test-faucet-skill.json',
  get_test_faucet: 'get-test-faucet-skill.json',
  'get test faucet': 'get-test-faucet-skill.json',
  'faucet-first': 'testcoin-faucet-first-skill.json',
  'testcoin-faucet-first-skill': 'testcoin-faucet-first-skill.json',
};

@Controller('skills')
export class SkillsController {
  private resolveSkillsDir(): string {
    const candidates = [
      path.resolve(process.cwd(), 'docs', 'skills'),
      path.resolve(process.cwd(), '..', '..', 'docs', 'skills'),
      path.resolve(__dirname, '..', '..', '..', '..', '..', 'docs', 'skills'),
    ];

    const found = candidates.find((dir) => fs.existsSync(dir));
    if (!found) {
      throw new NotFoundException('skills directory not found');
    }
    return found;
  }

  private loadSkillJson(fileName: string): any {
    const skillsDir = this.resolveSkillsDir();
    const fullPath = path.join(skillsDir, fileName);
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException(`skill file not found: ${fileName}`);
    }
    const raw = fs.readFileSync(fullPath, 'utf8');
    return JSON.parse(raw);
  }

  @Get()
  getSkillGuide() {
    const buy = this.loadSkillJson('testcoin-buy-skill.json');
    const getTestFaucet = this.loadSkillJson('get-test-faucet-skill.json');
    const faucetFirst = this.loadSkillJson('testcoin-faucet-first-skill.json');

    return {
      defaultSkill: 'get-test-faucet',
      endpoints: {
        list: '/v1/skills',
        getById: '/v1/skills/{skill_id}',
        openapiYaml: '/v1/skills/openapi.yaml',
        openapiJson: '/v1/docs-json',
      },
      skills: [
        {
          id: 'get-test-faucet',
          file: 'get-test-faucet-skill.json',
          name: getTestFaucet.name,
          version: getTestFaucet.version,
          url: '/v1/skills/get-test-faucet',
        },
        {
          id: 'buy',
          file: 'testcoin-buy-skill.json',
          name: buy.name,
          version: buy.version,
          url: '/v1/skills/buy',
        },
        {
          id: 'faucet-first',
          file: 'testcoin-faucet-first-skill.json',
          name: faucetFirst.name,
          version: faucetFirst.version,
          url: '/v1/skills/faucet-first',
        },
      ],
    };
  }

  @Get('openapi.yaml')
  @Header('Content-Type', 'application/yaml; charset=utf-8')
  getOpenApiYaml() {
    const skillsDir = this.resolveSkillsDir();
    const fullPath = path.join(skillsDir, 'openapi.yaml');
    if (!fs.existsSync(fullPath)) {
      throw new NotFoundException('openapi.yaml not found');
    }
    return fs.readFileSync(fullPath, 'utf8');
  }

  @Get(':skillId')
  getSkillById(@Param('skillId') skillId: string) {
    const fileName = skillFileById[skillId];
    if (!fileName) {
      throw new NotFoundException(`unknown skill: ${skillId}`);
    }
    return this.loadSkillJson(fileName);
  }
}
