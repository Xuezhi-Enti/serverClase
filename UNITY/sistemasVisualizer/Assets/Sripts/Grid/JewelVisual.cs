using UnityEngine;

public class JewelVisual : MonoBehaviour
{
    [SerializeField] private MeshRenderer meshRenderer;
    [SerializeField] private Material[] jewelMaterials;

    private NodeGrid.Node.JewelType currentType;

    public void Initialize()
    {
        if (meshRenderer == null)
            meshRenderer = GetComponent<MeshRenderer>();
    }

    public void SetJewelType(NodeGrid.Node.JewelType type)
    {
        currentType = type;

        if (type == NodeGrid.Node.JewelType.None)
        {
            meshRenderer.enabled = false;
        }
        else
        {
            meshRenderer.enabled = true;
            meshRenderer.material = jewelMaterials[(int)type - 1];
        }
    }

    public NodeGrid.Node.JewelType GetJewelType()
    {
        return currentType;
    }
}