<?php

declare(strict_types=1);

namespace Yii2Docs\Tools\Model;

use phpDocumentor\Reflection\Php\Enum_;
use yii\apidoc\models\BaseDoc;
use yii\apidoc\models\Context;
use yii\apidoc\models\TypeDoc;
use yii\helpers\StringHelper;

use function ltrim;

/**
 * Represents an `enum` in the yii2-apidoc model, which has no enum support of its own.
 *
 * Built from the `phpDocumentor` reflection `Enum_`: methods and constants come from {@see TypeDoc}, cases and the
 * backing type from the reflector.
 */
final class EnumDoc extends TypeDoc
{
    /**
     * @var string|null Backing type (`string`, `int`), or `null` for a pure enum.
     */
    public ?string $backingType = null;
    /**
     * @var array<string, EnumCaseDoc> Cases by name, in declaration order.
     */
    public array $cases = [];
    /**
     * @var list<string> Implemented interfaces as fully qualified names without a leading backslash.
     */
    public array $interfaces = [];
    /**
     * @var list<string> Used traits as fully qualified names without a leading backslash.
     */
    public array $traits = [];

    /**
     * @param Enum_ $reflector
     * @param Context|null $context
     * @param array<string, mixed> $config
     */
    public function __construct($reflector = null, $context = null, $config = [])
    {
        parent::__construct($reflector, $context, $config);

        if (!$reflector instanceof Enum_) {
            return;
        }

        $backed = $reflector->getBackedType();
        $this->backingType = $backed === null ? null : (string) $backed;

        foreach ($reflector->getInterfaces() as $interface) {
            $this->interfaces[] = ltrim((string) $interface, '\\');
        }

        foreach ($reflector->getUsedTraits() as $trait) {
            $this->traits[] = ltrim((string) $trait, '\\');
        }

        foreach ($reflector->getCases() as $case) {
            $docBlock = $case->getDocBlock();
            $value = $case->getValue();

            $this->cases[$case->getName()] = new EnumCaseDoc(
                $case->getName(),
                $value === null ? null : (string) $value,
                $docBlock === null ? '' : StringHelper::mb_ucfirst($docBlock->getSummary()),
                $docBlock === null ? '' : $docBlock->getDescription()->render(),
                $case->getLocation()->getLineNumber(),
            );
        }
    }

    /**
     * Finds a method, property, case or constant by name.
     *
     * @param string $subjectName
     */
    public function findSubject($subjectName): BaseDoc|EnumCaseDoc|null
    {
        $subject = parent::findSubject($subjectName);

        if ($subject !== null) {
            return $subject;
        }

        return $this->cases[$subjectName] ?? $this->constants[$subjectName] ?? null;
    }

    /**
     * Enums have no properties apart from the implicit `name` and `value`.
     *
     * @param mixed $reflector
     * @param mixed $context
     */
    protected function initProperties($reflector, $context): void
    {
        $this->properties = [];
    }
}
